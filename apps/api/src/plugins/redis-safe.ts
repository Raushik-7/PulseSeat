import type Redis from 'ioredis';
import { logger } from '../utils/logger';
import { getRedis } from './redis';

/**
 * Redis failure-tolerant cache helpers.
 *
 * Why this exists: on the free Upstash tier the connection can die (quota
 * exhausted, network blip, refund of the service). Every data path that used to
 * `await redis.get(...)` would then throw and turn a healthy Postgres-backed
 * page into an HTTP 500 — that is exactly how event cards "disappeared" from
 * the live site while the database was fine.
 *
 * Contract: cache is an optimization, never a dependency for public reads.
 * Every call is fire-tolerant: on any Redis failure we log once per outage and
 * degrade to Postgres.
 */

let degradedUntil = 0;
let degradationNotified = false;

const DEGRADE_WINDOW_MS = 30_000;
// Commands against a half-dead Redis (offline queue while disconnected) can
// hang indefinitely — every cache call is raced against this budget so a
// request path can NEVER stall on Redis.
const CMD_TIMEOUT_MS = 1_500;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`redis ${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function isDegraded(): boolean {
  return Date.now() < degradedUntil;
}

function noteFailure(err: unknown): void {
  degradedUntil = Date.now() + DEGRADE_WINDOW_MS;
  if (!degradationNotified) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ errMessage: message }, 'Redis unavailable — serving reads directly from Postgres (degraded cache mode) for 30s');
    degradationNotified = true;
    setTimeout(() => { degradationNotified = false; }, DEGRADE_WINDOW_MS);
  }
}

/** Cache-aside GET: returns the parsed value or undefined on miss/failure. */
export async function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  if (isDegraded()) return undefined;
  try {
    const redis = getRedis();
    const raw = await withTimeout(redis.get(key), CMD_TIMEOUT_MS, `get ${key.slice(0, 40)}`);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch (err) {
    noteFailure(err);
    return undefined;
  }
}

/** Cache-aside SET with TTL — failures are swallowed (cache only). */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (isDegraded()) return;
  try {
    const redis = getRedis();
    await withTimeout(redis.setex(key, ttlSeconds, JSON.stringify(value)), CMD_TIMEOUT_MS, `set ${key.slice(0, 40)}`);
  } catch (err) {
    noteFailure(err);
  }
}

/** Best-effort multi-key invalidation — failures are swallowed. */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (isDegraded()) return;
  try {
    const redis = getRedis();
    await withTimeout(redis.del(...keys), CMD_TIMEOUT_MS, 'del');
  } catch (err) {
    noteFailure(err);
  }
}

export { getRedis };
