import { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma';
import { logger } from '../../utils/logger';
import { config } from '../../config/index';
import {
  sendEmail,
  bookingConfirmationTemplate,
  bookingCancellationTemplate,
  type BookingConfirmationData,
  type BookingCancellationData,
} from './email.service';

// ─── Email outbox (Postgres-backed, no Redis, no BullMQ) ─────────────────────
//
// The previous implementation ran a BullMQ Worker inside the API process. That
// worker polls Redis whenever it is idle: one blocking BZPOPMIN on the queue
// marker every `drainDelay` (5s default) and one `moveToActive` EVALSHA per
// poll. On a free Upstash tier that idle loop — not user traffic — is what
// burned ~250k reads/month, and the worker also held three dedicated Redis
// connections (queue, unused notification queue, worker).
//
// Emails are rare compared with page traffic, so they are queued as rows in
// `email_outbox` instead and delivered by the maintenance loop:
//
//   booking commit → INSERT row → (best-effort immediate drain)
//                                    ↓ every 30s
//                  maintenance loop → claim rows (SKIP LOCKED) → SMTP → SENT
//
// Delivery is at-least-once. Failures are retried with exponential backoff and
// capped at `EMAIL_OUTBOX_MAX_ATTEMPTS`; nothing silently disappears.

export const MAX_ATTEMPTS = config.emailOutbox.maxAttempts;

type OutboxRow = {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
};

let draining = false;
let lastDrainAt = 0;

function renderMessage(row: OutboxRow) {
  switch (row.type) {
    case 'booking-confirmation':
      return bookingConfirmationTemplate(row.payload as BookingConfirmationData);
    case 'booking-cancellation':
      return bookingCancellationTemplate(row.payload as BookingCancellationData);
    default:
      throw new Error(`unknown email type '${row.type}'`);
  }
}

/**
 * Inserts one email row. If Postgres rejects the insert (the only failure mode
 * here), falls back to a direct best-effort send so the user still gets the
 * email, and reports the failure to the caller.
 */
async function enqueue(type: string, payload: unknown): Promise<void> {
  try {
    await prisma.emailOutbox.create({ data: { type, payload: payload as unknown as Prisma.InputJsonValue } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ type, errMessage: message }, 'Could not persist email job — attempting direct send');
    try {
      const sent = await sendEmail(renderMessage({ id: 'direct', type, payload, attempts: 0 }));
      if (!sent) logger.error({ type }, 'Direct email send also failed — email was NOT delivered');
    } catch (renderErr) {
      logger.error({ type, errMessage: renderErr instanceof Error ? renderErr.message : String(renderErr) }, 'Direct email fallback failed');
    }
    return;
  }

  // Best-effort immediate delivery so confirmations are not delayed by 30s.
  // Never awaited: the booking response must not wait on SMTP. If the process
  // dies here the row is still PENDING and the maintenance loop picks it up.
  scheduleDrain();
}

function scheduleDrain(): void {
  // Coalesce bursts (a checkout can emit 1–2 emails) and avoid starting a
  // drain for every single enqueue.
  if (draining) return;
  if (Date.now() - lastDrainAt < 1_000) return;
  void drainEmailOutbox().catch((err) => {
    logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'Inline email drain failed');
  });
}

export type BookingConfirmationJobData = BookingConfirmationData;

export type BookingCancellationJobData = BookingCancellationData;

/** Queue a booking confirmation email (post-commit, never blocks the booking). */
export async function enqueueBookingConfirmationEmail(data: BookingConfirmationJobData): Promise<void> {
  await enqueue('booking-confirmation', data);
}

/** Queue a booking cancellation email (post-commit, never blocks the cancellation). */
export async function enqueueBookingCancellationEmail(data: BookingCancellationJobData): Promise<void> {
  await enqueue('booking-cancellation', data);
}

/**
 * Claims and delivers up to `limit` due emails.
 * Safe to call from every instance: rows are claimed with SKIP LOCKED.
 * Returns the number of emails actually sent.
 */
export async function drainEmailOutbox(limit = config.emailOutbox.batchSize): Promise<number> {
  if (draining) return 0;
  draining = true;
  lastDrainAt = Date.now();

  try {
    // Reclaim rows stuck in SENDING (process died mid-send). At-least-once: a
    // crash after SMTP accepted the message may duplicate one email.
    await prisma.$executeRaw`
      UPDATE "email_outbox"
         SET "status" = 'PENDING', "updated_at" = now()
       WHERE "status" = 'SENDING'
         AND "updated_at" < now() - interval '5 minutes'
    `;

    const claimed = await prisma.$queryRaw<OutboxRow[]>`
      WITH due AS (
        SELECT "id"
          FROM "email_outbox"
         WHERE "status" = 'PENDING'
           AND "next_attempt_at" <= now()
         ORDER BY "created_at" ASC
         LIMIT ${limit}
         FOR UPDATE SKIP LOCKED
      )
      UPDATE "email_outbox" o
         SET "status" = 'SENDING',
             "attempts" = o."attempts" + 1,
             "updated_at" = now()
        FROM due
       WHERE o."id" = due."id"
      RETURNING o."id", o."type", o."payload", o."attempts"
    `;

    if (claimed.length === 0) return 0;

    const sentIds: string[] = [];
    for (const row of claimed) {
      let sent = false;
      let failure = 'send failed';

      try {
        sent = await sendEmail(renderMessage(row));
        if (!sent) failure = 'SMTP transport reported failure';
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err);
      }

      if (sent) {
        sentIds.push(row.id);
        continue;
      }

      const exhausted = row.attempts >= MAX_ATTEMPTS;
      if (exhausted) {
        await prisma.$executeRaw`
          UPDATE "email_outbox"
             SET "status" = 'FAILED', "last_error" = ${failure}, "updated_at" = now()
           WHERE "id" = ${row.id}
        `;
        logger.error({ id: row.id, type: row.type, attempts: row.attempts, failure }, 'Email permanently failed after max attempts');
      } else {
        const backoffMs = Math.min(config.emailOutbox.retryBaseMs * 2 ** (row.attempts - 1), 60 * 60 * 1000);
        await prisma.$executeRaw`
          UPDATE "email_outbox"
             SET "status" = 'PENDING',
                 "last_error" = ${failure},
                 "next_attempt_at" = now() + ${`${Math.round(backoffMs / 1000)} seconds`}::interval,
                 "updated_at" = now()
           WHERE "id" = ${row.id}
        `;
        logger.warn({ id: row.id, type: row.type, attempts: row.attempts, retryInMs: backoffMs, failure }, 'Email send failed — scheduled retry');
      }
    }

    if (sentIds.length > 0) {
      await prisma.$executeRaw`
        UPDATE "email_outbox"
           SET "status" = 'SENT', "sent_at" = now(), "updated_at" = now(), "last_error" = NULL
         WHERE "id" = ANY(${sentIds}::text[])
      `;
    }

    // Rows that exhausted their attempts are kept for inspection; delivered rows
    // are pruned by the hourly maintenance task.
    return sentIds.length;
  } catch (err) {
    logger.error(
      { errMessage: err instanceof Error ? err.message : String(err) },
      'Email outbox drain failed (will retry on the next maintenance tick)',
    );
    return 0;
  } finally {
    draining = false;
  }
}

/** Hourly housekeeping: drop delivered rows older than the retention window. */
export async function purgeDeliveredEmails(): Promise<number> {
  const res = await prisma.emailOutbox.deleteMany({
    where: {
      status: 'SENT',
      sentAt: { lt: new Date(Date.now() - config.emailOutbox.retainSentDays * 24 * 60 * 60 * 1000) },
    },
  });
  return res.count;
}

/** Diagnostics: outbox depth by status (no Redis involvement). */
export async function getEmailOutboxStats(): Promise<Record<string, number>> {
  const rows = await prisma.emailOutbox.groupBy({ by: ['status'], _count: true });
  const out: Record<string, number> = { PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0 };
  for (const r of rows) out[r.status] = r._count;
  return out;
}
