import { Queue, Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../../plugins/redis';
import { sendEmail, bookingConfirmationTemplate, bookingCancellationTemplate } from '../email/email.service';
import { logger } from '../../utils/logger';
import { config } from '../../config/index';

// ─── BullMQ Job Queues ───────────────────────────────────────────────────────
//
// Background job processing for email, analytics, and notifications.
// Uses Redis as the message broker.
//
// Flow after booking:
//   Booking committed → Enqueue job → Worker picks up → Send email → Done
//
// This keeps the booking API fast. Users don't wait for email delivery.

// ─── Email Queue ─────────────────────────────────────────────────────────────

export const emailQueue = new Queue('emails', {
  connection: getBullMQConnection(),
  defaultJobOptions: {
    attempts: config.queue.retryAttempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.retryDelayMs,
    },
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 },
  },
});

// ─── Notification Queue ──────────────────────────────────────────────────────

export const notificationQueue = new Queue('notifications', {
  connection: getBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 25 },
  },
});

// ─── Email Worker ────────────────────────────────────────────────────────────

let emailWorker: Worker | null = null;

export function startEmailWorker(): Worker {
  if (emailWorker) return emailWorker;

  emailWorker = new Worker(
    'emails',
    async (job: Job) => {
      logger.info({ jobId: job.id, type: job.name }, '📧 Processing email job');

      switch (job.name) {
        case 'booking-confirmation': {
          const data = job.data;
          const email = bookingConfirmationTemplate(data);
          const sent = await sendEmail(email);
          if (!sent) throw new Error('Email delivery failed');
          return { sent: true, to: data.userEmail };
        }

        case 'booking-cancellation': {
          const data = job.data;
          const email = bookingCancellationTemplate(data);
          const sent = await sendEmail(email);
          if (!sent) throw new Error('Email delivery failed');
          return { sent: true, to: data.userEmail };
        }

        default:
          logger.warn({ jobName: job.name }, 'Unknown email job type');
          return { skipped: true };
      }
    },
    {
      connection: getBullMQConnection(),
      concurrency: config.queue.concurrency,
    },
  );

  emailWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, type: job.name }, '📧 Email job completed');
  });

  emailWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, type: job?.name, err }, '📧 Email job failed');
  });

  logger.info(`📧 Email worker started (concurrency: ${config.queue.concurrency})`);
  return emailWorker;
}

// ─── Job Enqueueing Helpers ──────────────────────────────────────────────────

export interface BookingConfirmationJobData {
  userName: string;
  userEmail: string;
  bookingReference: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  seats: Array<{ seatNumber: string; row: string; section: string }>;
  totalAmount: number;
}

export interface BookingCancellationJobData {
  userName: string;
  userEmail: string;
  bookingReference: string;
  eventName: string;
  refundAmount: number;
}

/**
 * Enqueue a booking confirmation email.
 * Called after a successful booking commit.
 */
export async function enqueueBookingConfirmationEmail(data: BookingConfirmationJobData): Promise<void> {
  await emailQueue.add('booking-confirmation', data, {
    priority: 1, // High priority
    delay: 0, // Send immediately
  });
  logger.info({ bookingReference: data.bookingReference }, '📧 Booking confirmation email queued');
}

/**
 * Enqueue a booking cancellation email.
 * Called after a successful booking cancellation.
 */
export async function enqueueBookingCancellationEmail(data: BookingCancellationJobData): Promise<void> {
  await emailQueue.add('booking-cancellation', data, {
    priority: 1,
    delay: 0,
  });
  logger.info({ bookingReference: data.bookingReference }, '📧 Booking cancellation email queued');
}

/**
 * Gracefully shut down workers.
 */
export async function closeQueues(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
  await emailQueue.close();
  await notificationQueue.close();
  logger.info('📧 Email queues and workers shut down');
}
