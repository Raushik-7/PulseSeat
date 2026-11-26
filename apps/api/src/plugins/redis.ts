import Redis, { type RedisOptions } from 'ioredis';
import { config } from '../config/index';
import { logger } from '../utils/logger';

// ─── Central Redis connection ────────────────────────────────────────────────
//
// This is the ONLY place a Redis client is created. Everything Redis-backed
// (event/availability cache, auth tokens) shares this one connection; there is
// deliberately no queue connection any more (the BullMQ worker was replaced by
// the Postgres email outbox, see modules/email/email.outbox.ts).
//
// Design rules, all learned from the Upstash free-tier outage:
//
//  1. Redis is OPTIONAL. Nothing may block server boot on it, and nothing may
//     throw because of it — callers go through plugins/redis-safe.ts.
//  2. Commands fail FAST. enableOfflineQueue:false means a command issued while
//     disconnected rejects immediately instead of sitting in a queue until the
//     socket returns (which is what made requests hang for seconds).
//  3. Reconnects are BOUNDED. The old client retried forever at a 2s ceiling;
//     during a quota exhaustion that is a permanent reconnect loop. After
//     maxReconnectAttempts the client stops, and the next caller (gated by the
//     circuit breaker's cooldown) re-creates it.
//  4. Provider-neutral. Only REDIS_URL is used; `rediss://` enables TLS through
//     ioredis automatically, so Upstash → Redis Cloud/Railway/self-hosted is a
//     URL swap. REDIS_ENABLED=false disables Redis entirely.

let client: Redis | null = null;
let recreateAfter = 0;
let lastErrorLogAt = 0;
let doomedLogged = false;

const ERROR_LOG_INTERVAL_MS = 30_000;

export function isRedisEnabled(): boolean {
  return config.redis.enabled && Boolean(config.redis.url);
}

function buildOptions(): RedisOptions {
  return {
    // Connect on demand: `startRedis()` (or the first real command) triggers it.
    lazyConnect: true,
    // Never buffer commands while disconnected — the cache must fail instantly.
    enableOfflineQueue: false,
    // One retry inside the client, then surface the error to redis-safe, which
    // owns the circuit breaker. Prevents retry storms on quota errors.
    maxRetriesPerRequest: 1,
    connectTimeout: config.redis.connectTimeoutMs,
    commandTimeout: config.redis.commandTimeoutMs,
    keepAlive: 10_000,
    retryStrategy(times) {
      if (times > config.redis.maxReconnectAttempts) {
        if (!doomedLogged) {
          doomedLogged = true;
          logger.warn(
            { attempts: times - 1 },
            'Redis reconnect budget exhausted — pausing reconnects; cache stays in degraded mode',
          );
        }
        recreateAfter = Date.now() + config.redis.reconnectCooldownMs;
        return null; // stop reconnecting; getRedis() re-creates it later
      }
      return Math.min(times * 250, 5_000);
    },
  };
}

function attachHandlers(redis: Redis): void {
  redis.on('ready', () => {
    doomedLogged = false;
    logger.info('Redis connected');
  });

  redis.on('error', (err: Error) => {
    // ioredis emits an error per failed reconnect attempt; throttle so an outage
    // does not flood the logs (and, on Render, the log-based billing quota).
    const now = Date.now();
    if (now - lastErrorLogAt < ERROR_LOG_INTERVAL_MS) return;
    lastErrorLogAt = now;
    logger.warn({ errMessage: err.message }, 'Redis connection error (cache degradation may follow)');
  });

  redis.on('end', () => {
    if (!doomedLogged) {
      logger.warn('Redis connection closed');
    }
  });
}

/**
 * Returns the shared client, or null when Redis is disabled.
 *
 * A client in `end` state (gave up reconnecting) is discarded and re-created
 * once the cooldown has passed, so recovery needs no restart.
 */
export function getRedis(): Redis | null {
  if (!isRedisEnabled()) return null;

  if (client && client.status === 'end') {
    if (Date.now() < recreateAfter) return null;
    client.removeAllListeners();
    client = null;
  }

  if (!client) {
    client = new Redis(config.redis.url, buildOptions());
    attachHandlers(client);
  }

  return client;
}

/** Returns the shared client only if it can serve commands right now. */
export function getReadyRedis(): Redis | null {
  const redis = getRedis();
  if (!redis) return null;
  // Self-healing: if the initial connect never happened (or the client was
  // parked after `end`), kick it off without awaiting — callers must not wait.
  if (redis.status === 'wait') {
    void redis.connect().catch(() => {
      // Retry/backoff and logging are handled by retryStrategy/handlers.
    });
    return null;
  }
  return redis.status === 'ready' ? redis : null;
}

/**
 * Kick off the initial connection without blocking startup.
 * Failure is logged and ignored: the API runs fine on Postgres alone.
 */
export function startRedis(): void {
  if (!isRedisEnabled()) {
    logger.warn('Redis disabled (REDIS_ENABLED=false or no REDIS_URL) — caching and token storage run in degraded mode');
    return;
  }

  const redis = getRedis();
  if (!redis) return;

  const attempt = redis.status === 'wait' ? redis.connect() : Promise.resolve();
  attempt
    .then(() => logger.info('Redis connection established'))
    .catch((err: unknown) => {
      logger.warn(
        { errMessage: err instanceof Error ? err.message : String(err) },
        'Redis unavailable at startup — continuing without cache (reads fall back to Postgres)',
      );
    });
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  // QUIT on a half-dead/reconnecting socket can never be acknowledged, which
  // would hang shutdown. Give it a moment, then drop the socket outright.
  try {
    await Promise.race([
      current.quit(),
      new Promise<void>((resolve) => setTimeout(resolve, 1_500)),
    ]);
  } catch {
    // fall through to disconnect
  } finally {
    try {
      current.disconnect();
    } catch {
      // already closed
    }
  }
}

/** Test seam — only used by the resilience check script. */
export function __resetRedisForTests(): void {
  client = null;
  recreateAfter = 0;
  doomedLogged = false;
  lastErrorLogAt = 0;
}
