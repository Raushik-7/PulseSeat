import type Redis from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config/index';
import { getReadyRedis, isRedisEnabled } from './redis';

// ─── Redis safety layer: circuit breaker + failure-tolerant commands ─────────
//
// Every Redis call in the application goes through this module. Redis is an
// OPTIMIZATION here (event/availability cache) or a short-lived security store
// with a Postgres fallback (auth tokens) — never a hard dependency of a request.
//
// Before this layer existed, a `await redis.get(...)` on an exhausted Upstash
// quota (or a half-open socket) either threw — turning a healthy Postgres page
// into an HTTP 500 — or hung until the socket timeout, leaving the UI on a
// loading spinner. This is exactly how event cards "disappeared" while the
// database was fine.
//
// Guarantees:
//   • No command is issued while the client is not `ready` (nothing to wait on).
//   • Command failures are counted; after FAILURE_THRESHOLD consecutive failures
//     the breaker OPENS for COOLDOWN_MS and *no commands are sent at all*, so a
//     broken provider is not hammered (and quota is not burned).
//   • After the cooldown exactly ONE probe command is allowed (half-open). If it
//     succeeds the breaker closes; if it fails the cooldown restarts.
//   • Failures are logged once per state transition, never per call.
//
// This is intentionally a ~100-line in-process breaker, not a new dependency.

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = config.redis.breakerCooldownMs;

type BreakerState = 'closed' | 'open' | 'half-open';

let state: BreakerState = 'closed';
let consecutiveFailures = 0;
let openUntil = 0;
let probeInFlight = false;
let transitions = 0;

export interface RedisHealth {
  status: 'ok' | 'degraded' | 'disabled';
  latencyMs?: number;
  detail?: string;
  circuit: BreakerState;
}

export function getRedisCircuitState(): BreakerState {
  if (state === 'open' && Date.now() >= openUntil) return 'half-open';
  return state;
}

function openCircuit(reason: string): void {
  state = 'open';
  openUntil = Date.now() + COOLDOWN_MS;
  transitions += 1;
  logger.error(
    { reason, cooldownMs: COOLDOWN_MS, transitions },
    'Redis circuit OPEN — pausing Redis commands; serving from Postgres until recovery',
  );
}

function recordFailure(err: unknown, label: string): void {
  consecutiveFailures += 1;
  const message = err instanceof Error ? err.message : String(err);
  if (state === 'half-open' || consecutiveFailures >= FAILURE_THRESHOLD) {
    openCircuit(`${label}: ${message}`);
  }
}

function recordSuccess(): void {
  if (state !== 'closed') {
    logger.info({ transitions }, 'Redis circuit CLOSED — cache and token storage restored');
  }
  state = 'closed';
  consecutiveFailures = 0;
  openUntil = 0;
}

/**
 * Runs one Redis command under the breaker. Returns undefined on any failure or
 * when Redis is disabled/not connected — callers must treat that as "no cache".
 */
async function run<T>(label: string, fn: (redis: Redis) => Promise<T>): Promise<T | undefined> {
  if (!isRedisEnabled()) return undefined;

  if (state === 'open') {
    if (Date.now() < openUntil) return undefined;
    state = 'half-open';
  }

  const isProbe = state === 'half-open';
  if (isProbe) {
    if (probeInFlight) return undefined;
    probeInFlight = true;
  }

  try {
    // A client that is connecting (or that gave up) cannot serve commands; skip
    // without counting a failure, so startup races never open the breaker.
    const redis = getReadyRedis();
    if (!redis) return undefined;

    const result = await fn(redis);
    recordSuccess();
    return result;
  } catch (err) {
    recordFailure(err, label);
    return undefined;
  } finally {
    if (isProbe) probeInFlight = false;
  }
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

/** Cache-aside GET: returns the parsed value or undefined on miss/failure. */
export async function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  const raw = await run(`get ${key.slice(0, 48)}`, (redis) => redis.get(key));
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt/foreign value under our key — treat as a miss, not a Redis failure.
    return undefined;
  }
}

/** Cache-aside SET with TTL — failures are swallowed (cache only). */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch {
    return;
  }
  await run(`set ${key.slice(0, 48)}`, (redis) => redis.setex(key, ttlSeconds, payload));
}

/** Best-effort multi-key invalidation — failures are swallowed. */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await run('del', (redis) => redis.del(...keys));
}

/**
 * Atomic counter increment (used for the event-list cache epoch).
 * One command instead of the previous read-modify-write (GET + SET).
 */
export async function cacheIncr(key: string): Promise<number | undefined> {
  return run(`incr ${key.slice(0, 48)}`, (redis) => redis.incr(key));
}

// ─── Raw string helpers (auth tokens: hashed, TTL-bounded) ───────────────────

export async function rawGet(key: string): Promise<string | null | undefined> {
  return run(`get ${key.slice(0, 48)}`, (redis) => redis.get(key));
}

export async function rawSetEx(key: string, ttlSeconds: number, value: string): Promise<boolean> {
  const res = await run(`setex ${key.slice(0, 48)}`, (redis) => redis.setex(key, ttlSeconds, value));
  return res === 'OK';
}

export async function rawDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await run('del', (redis) => redis.del(...keys));
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/**
 * One PING, breaker-aware. Used by /health/deps (manual diagnosis only).
 * Never used by liveness/readiness probes.
 */
export async function pingRedis(): Promise<RedisHealth> {
  if (!isRedisEnabled()) return { status: 'disabled', circuit: 'closed' };
  if (state === 'open' && Date.now() < openUntil) {
    return {
      status: 'degraded',
      circuit: 'open',
      detail: 'circuit open — probes paused to conserve commands',
    };
  }

  const started = Date.now();
  const pong = await run('ping', (redis) => redis.ping());
  if (pong !== 'PONG') {
    return { status: 'degraded', circuit: getRedisCircuitState(), detail: 'ping failed or client not connected' };
  }
  return { status: 'ok', latencyMs: Date.now() - started, circuit: 'closed' };
}

export { isRedisEnabled };
