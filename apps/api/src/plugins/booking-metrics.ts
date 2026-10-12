import { prisma } from './prisma';
import { logger } from '../utils/logger';

/**
 * Booking-funnel metrics — persisted in PostgreSQL instead of Redis.
 *
 * Previously every booking attempt/confirm/conflict/cancel issued a Redis INCR
 * (and `/metrics` read them back with 4 GETs per scrape). On the free Upstash
 * tier those were pure overhead; a Redis outage also risked failing parts of
 * the booking flow just to bump a counter.
 *
 * Cost: one UPSERT per metric event, scoped to bookings (rare compared to
 * page traffic). Zero Redis commands.
 */

export async function recordBookingMetric(
  metric: 'attempts' | 'conflicts' | 'success' | 'cancellations',
): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO metric_counters (metric, n)
      VALUES (${metric}, 1)
      ON CONFLICT (metric) DO UPDATE SET n = metric_counters.n + 1, updated_at = now()
    `;
  } catch (err) {
    // Metrics must never affect the booking flow.
    logger.warn({ metric, errMessage: err instanceof Error ? err.message : String(err) }, 'booking metric persist failed');
  }
}

export async function getBookingMetrics(): Promise<Record<string, number>> {
  try {
    const rows = await prisma.$queryRaw<Array<{ metric: string; n: bigint }>>`
      SELECT metric, n FROM metric_counters
    `;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.metric] = Number(r.n);
    for (const key of ['attempts', 'conflicts', 'success', 'cancellations']) {
      if (!(key in out)) out[key] = 0;
    }
    return out;
  } catch (err) {
    logger.warn({ errMessage: err instanceof Error ? err.message : String(err) }, 'booking metric read failed');
    return { attempts: 0, conflicts: 0, success: 0, cancellations: 0 };
  }
}

// Bridge for legacy counters (values written to Redis before this change).
// Reads each key once per /metrics scrape (already bounded); deletes nothing.
export async function hydrateLegacyRedisMetrics(keys: Record<string, string>): Promise<void> {
  try {
    const { getRedis } = await import('./redis');
    const redis = getRedis();
    for (const [metric, key] of Object.entries(keys)) {
      const raw = await redis.get(key);
      if (raw && Number(raw) > 0) {
        await prisma.$executeRaw`
          INSERT INTO metric_counters (metric, n)
          VALUES (${metric}, ${Number(raw)})
          ON CONFLICT (metric) DO UPDATE SET n = metric_counters.n + ${Number(raw)}, updated_at = now()
        `;
      }
    }
  } catch (err) {
    logger.warn({ errMessage: err instanceof Error ? err.message : String(err) }, 'legacy metric hydration skipped');
  }
}
