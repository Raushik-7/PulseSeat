import { prisma } from './plugins/prisma';
import { purgeExpiredIdempotencyKeys } from './modules/bookings/booking.service';
import { logger } from './utils/logger';
import { cacheGet, cacheDel } from './plugins/redis-safe';

/**
 * Low-frequency maintenance loop (Phase E/F hardening).
 *
 * Runs wall-clock-driven housekeeping in ONE process (guarded by a Postgres
 * advisory lock so a multi-instance deploy would not double-run):
 *
 *  every 1h : purge expired idempotency keys (keeps the table small; Postgres
 *             is now the idempotency store — see booking.service.ts)
 *  every 30s: expire bookings whose PENDING hold expired, releasing their
 *             seats back to AVAILABLE. Previously expired holds were only
 *             cleaned opportunistically by availability reads.
 *
 * Uses no Redis except to opportunistically clear the availability cache key
 * (best-effort, failure-tolerant).
 */

const ADAPTIVE_LOCK_ID = 918273645;

export function startMaintenanceLoop(): void {
  const timer = setInterval(async () => {
    // Advisory lock ensures this only executes while we hold the global lock
    const [{ locked }] = (await prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${ADAPTIVE_LOCK_ID}) as locked
    `) as Array<{ locked: boolean }>;
    if (!locked) return;

    try {
      // ── 1. Purge expired idempotency keys ──
      const purged = await purgeExpiredIdempotencyKeys();
      if (purged > 0) logger.info({ purged }, 'maintenance: purged expired idempotency keys');

      // ── 2. Release seats from expired PENDING holds ──
      const expired = await prisma.$transaction(async (tx) => {
        const staleBookings = await tx.booking.findMany({
          where: { status: 'PENDING', holdExpiresAt: { lt: new Date() } },
          select: { id: true, eventId: true },
          take: 100,
        });

        for (const booking of staleBookings) {
          const seats = await tx.bookingItem.findMany({
            where: { bookingId: booking.id },
            select: { seatId: true },
          });
          await tx.seat.updateMany({
            where: { id: { in: seats.map((s) => s.seatId) } },
            data: { status: 'AVAILABLE', bookedBy: null },
          });
          await tx.booking.update({ where: { id: booking.id }, data: { status: 'EXPIRED' } });
        }
        return staleBookings.map((b) => b.eventId);
      });

      if (expired.length > 0) {
        const uniqueEventIds = [...new Set(expired)];
        for (const eventId of uniqueEventIds) {
          await cacheDel(`event:${eventId}:availability`, `event:${eventId}`);
        }
        logger.info({ bookingsExpired: expired.length, events: uniqueEventIds.length }, 'maintenance: expired holds released');
      }
    } catch (err) {
      logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'maintenance loop iteration failed');
    } finally {
      await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock(${ADAPTIVE_LOCK_ID})`).catch(() => 'unlocked');
    }
  }, 30_000);

  // Keep the process from waiting on this timer at exit
  if (typeof timer === 'object' && timer && typeof (timer as any).unref === 'function') {
    (timer as unknown as { unref: () => void }).unref();
  }
}

export function stopMaintenanceLoop(): void {
  logger.info('Maintenance loop stopped (process exiting)');
}
