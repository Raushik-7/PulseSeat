import { prisma } from './plugins/prisma';
import { purgeExpiredIdempotencyKeys } from './modules/bookings/booking.service';
import { drainEmailOutbox, purgeDeliveredEmails } from './modules/email/email.outbox';
import { logger } from './utils/logger';
import { cacheDel } from './plugins/redis-safe';

/**
 * Low-frequency maintenance loop (single leader per cluster).
 *
 * Runs wall-clock-driven housekeeping in ONE process at a time:
 *
 *  every 30s : deliver due email-outbox rows (no Redis — see email.outbox.ts)
 *  every 30s : expire bookings whose PENDING hold expired, releasing seats
 *  hourly    : purge expired idempotency keys + delivered email rows
 *
 * Leader election uses `pg_try_advisory_xact_lock` inside a transaction, so the
 * lock is released by Postgres when the transaction ends. The previous version
 * used a session-level lock/unlock pair across two pooled connections, which
 * could leave the lock held on a pooled connection forever and silently stop
 * the loop for every instance.
 *
 * Redis is touched only to invalidate availability cache keys when holds
 * actually expire (best-effort, failure-tolerant) — never on an idle tick.
 */

const MAINTENANCE_LOCK_ID = 918273645;
const TICK_MS = 30_000;
const HOURLY_MS = 60 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let bootKick: ReturnType<typeof setTimeout> | null = null;
let lastHourlyRun = 0;

type ExpiredBookingRow = { id: string; event_id: string };

/**
 * Releases seats held by expired PENDING bookings.
 * Three queries regardless of how many bookings expired (previously N+1).
 */
async function releaseExpiredHolds(): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const stale = await tx.$queryRaw<ExpiredBookingRow[]>`
      SELECT id, event_id
        FROM bookings
       WHERE status = 'PENDING'
         AND hold_expires_at IS NOT NULL
         AND hold_expires_at < now()
       ORDER BY hold_expires_at ASC
       LIMIT 100
       FOR UPDATE SKIP LOCKED
    `;
    if (stale.length === 0) return [];

    const bookingIds = stale.map((b) => b.id);

    await tx.$executeRaw`
      UPDATE seats
         SET status = 'AVAILABLE', booked_by = NULL, updated_at = now()
       WHERE id IN (
         SELECT seat_id FROM booking_items WHERE booking_id = ANY(${bookingIds}::text[])
       )
    `;

    await tx.$executeRaw`
      UPDATE bookings
         SET status = 'EXPIRED', updated_at = now()
       WHERE id = ANY(${bookingIds}::text[])
    `;

    return [...new Set(stale.map((b) => b.event_id))];
  });
}

async function runHousekeeping(): Promise<void> {
  const ranAsLeader = await prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${MAINTENANCE_LOCK_ID}) AS locked
    `;
    if (!locked) return false;

    const now = Date.now();
    if (now - lastHourlyRun >= HOURLY_MS) {
      lastHourlyRun = now;
      // Each purge is isolated: a missing table (deployed before migrating) or
      // a lock timeout must not stop hold-expiry from running every 30s.
      try {
        const purgedKeys = await purgeExpiredIdempotencyKeys();
        if (purgedKeys > 0) logger.info({ purged: purgedKeys }, 'maintenance: purged expired idempotency keys');
      } catch (err) {
        logger.warn({ errMessage: err instanceof Error ? err.message : String(err) }, 'maintenance: idempotency purge skipped');
      }
      try {
        const purgedEmails = await purgeDeliveredEmails();
        if (purgedEmails > 0) logger.info({ purged: purgedEmails }, 'maintenance: pruned delivered email outbox rows');
      } catch (err) {
        logger.warn({ errMessage: err instanceof Error ? err.message : String(err) }, 'maintenance: email prune skipped');
      }
    }

    return true;
  });

  if (!ranAsLeader) return;

  const expiredEventIds = await releaseExpiredHolds();
  if (expiredEventIds.length > 0) {
    for (const eventId of expiredEventIds) {
      await cacheDel(`event:${eventId}:availability`, `event:${eventId}`);
    }
    logger.info({ events: expiredEventIds.length }, 'maintenance: expired holds released');
  }
}

export function startMaintenanceLoop(): void {
  const tick = async () => {
    try {
      await runHousekeeping();
    } catch (err) {
      logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'maintenance: housekeeping failed');
    }

    // Email delivery is claimed with SKIP LOCKED, so every instance may safely
    // attempt it; this also keeps email flowing when no instance holds the
    // maintenance lock.
    try {
      const sent = await drainEmailOutbox();
      if (sent > 0) logger.info({ sent }, 'maintenance: delivered queued emails');
    } catch (err) {
      logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'maintenance: email drain failed');
    }
  };

  timer = setInterval(tick, TICK_MS);
  if (typeof timer === 'object' && timer && typeof timer.unref === 'function') {
    timer.unref(); // never hold the process open
  }

  // Drain anything left over from a previous run shortly after boot, without
  // competing with startup work.
  bootKick = setTimeout(tick, 5_000);
  if (typeof bootKick === 'object' && typeof bootKick.unref === 'function') bootKick.unref();
}

export function stopMaintenanceLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (bootKick) {
    clearTimeout(bootKick);
    bootKick = null;
  }
  logger.info('Maintenance loop stopped (process exiting)');
}
