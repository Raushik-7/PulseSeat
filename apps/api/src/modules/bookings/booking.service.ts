import { createHash } from 'crypto';
import { PrismaClient, SeatStatus, BookingStatus, PaymentStatus, PaymentProviderType } from '@prisma/client';
import { createBookingReference } from '../../utils/booking-reference';
import { SeatConflictError, ConflictError, ValidationError, NotFoundError, PaymentError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { cacheDel } from '../../plugins/redis-safe';
import { recordBookingMetric } from '../../plugins/booking-metrics';
import { bumpEventsListVersion } from '../events/events.cache';
import { config } from '../../config/index';
import { getPaymentProvider, PaymentIntent } from '../payments/payments.service';
import { enqueueBookingConfirmationEmail, enqueueBookingCancellationEmail } from '../email/email.worker';
import { broadcastBulkSeatUpdate, broadcastAvailabilityUpdate } from '../../plugins/websocket';
import { prisma } from '../../plugins/prisma';

// ─── Concurrency-Safe Booking Service ────────────────────────────────────────
//
// This is the most critical module in the application.
//
// It uses PostgreSQL transactions with SELECT FOR UPDATE to ensure
// that concurrent booking requests cannot double-book any seat.
//
// The flow:
//   1. Validate input
//   2. Check idempotency
//   3. BEGIN TRANSACTION
//   4. Lock requested seats in deterministic order (ascending seat ID)
//   5. Verify all seats are AVAILABLE
//   6. Create payment intent (Stripe)
//   7. Create booking record
//   8. Update seat status to BOOKED
//   9. COMMIT
//  10. Queue background jobs (email, analytics)
//  11. Broadcast real-time seat updates via WebSocket
//  12. Return success
//
// If any step fails, the transaction is rolled back completely.
// No partial bookings are ever created.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BookSeatsInput {
  userId: string;
  eventId: string;
  seatIds: string[];
  idempotencyKey?: string;
  paymentMethodId?: string; // Stripe PaymentMethod ID for real payments
}

export interface BookingResult {
  bookingId: string;
  bookingReference: string;
  totalAmount: number;
  seatCount: number;
  payment: {
    status: string;
    clientSecret?: string; // Stripe client secret for frontend confirmation
    provider: string;
  };
}

// ─── Idempotency (Postgres-backed) ───────────────────────────────────────────
// Previously idempotent replays were cached in Redis with no expiry-checking
// and vanished on Redis restarts. IdempotencyKeys live in Postgres now (the
// model already existed), so replays survive cache outages and restarts.

function idempotencyRequestHash(input: BookSeatsInput): string {
  return createHash('sha256').update(JSON.stringify({
    userId: input.userId,
    eventId: input.eventId,
    seatIds: [...input.seatIds].sort(),
  })).digest('hex').slice(0, 32);
}

/** Returns the stored booking result for a replayed idempotent request. */
async function findIdempotentBooking(
  idempotencyKey: string,
  input: BookSeatsInput,
): Promise<BookingResult | undefined> {
  try {
    const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
    if (!existing) return undefined;
    if (existing.expiresAt < new Date()) {
      await prisma.idempotencyKey.delete({ where: { key: idempotencyKey } });
      return undefined;
    }
    if (existing.requestHash !== idempotencyRequestHash(input)) {
      throw new ConflictError('Idempotency key already used with a different request');
    }
    return existing.responseBody as unknown as BookingResult;
  } catch (err) {
    if (err instanceof ConflictError) throw err;
    logger.warn({ idempotencyKey, errMessage: err instanceof Error ? err.message : String(err) }, 'Idempotency lookup failed — proceeding without it');
    return undefined;
  }
}

/** Persists a booking result under its idempotency key after commit. */
async function persistIdempotencyKey(
  idempotencyKey: string,
  input: BookSeatsInput,
  result: BookingResult,
): Promise<void> {
  try {
    await prisma.idempotencyKey.upsert({
      where: { key: idempotencyKey },
      create: {
        key: idempotencyKey,
        requestHash: idempotencyRequestHash(input),
        responseStatus: 201,
        responseBody: JSON.parse(JSON.stringify(result)),
        expiresAt: new Date(Date.now() + config.booking.idempotencyExpiryS * 1000),
      },
      update: {}, // first-write-wins — a replay must never overwrite
    });
  } catch (err) {
    logger.warn({ idempotencyKey, errMessage: err instanceof Error ? err.message : String(err) }, 'Idempotency persist failed (non-fatal)');
  }
}

/** Deletes expired idempotency keys. Called by the maintenance loop. */
export async function purgeExpiredIdempotencyKeys(): Promise<number> {
  const res = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}

// ─── Create Booking ─────────────────────────────────────────────────────────

export async function createBooking(input: BookSeatsInput): Promise<BookingResult> {
  const { userId, eventId, seatIds, idempotencyKey } = input;

  // 1. Validate input
  if (!seatIds.length) {
    throw new ValidationError('At least one seat must be selected');
  }
  if (seatIds.length > 10) {
    throw new ValidationError('Maximum 10 seats per booking');
  }

  // Deduplicate and sort seat IDs for deterministic lock ordering
  const uniqueSeatIds = [...new Set(seatIds)].sort();

  // 2. Check idempotency — stored in Postgres (authoritative), not Redis
  if (idempotencyKey) {
    const replayed = await findIdempotentBooking(idempotencyKey, input);
    if (replayed) return replayed;
  }

  // 3. Increment booking attempt metric (Postgres; never fails the flow)
  recordBookingMetric('attempts');

  // 4. Execute booking transaction
  logger.info({ userId, eventId, seatCount: uniqueSeatIds.length }, 'Starting booking transaction');

  const result = await prisma.$transaction(
    async (tx) => {
      // Lock seats in deterministic order to prevent deadlocks
      const seats = await tx.$queryRaw<
        Array<{
          id: string;
          event_id: string;
          seat_number: string;
          row: string;
          section: string;
          price: string;
          status: string;
          booked_by: string | null;
        }>
      >`
        SELECT id, event_id, seat_number, row, section, price, status, booked_by
        FROM seats
        WHERE id = ANY(${uniqueSeatIds})
        ORDER BY id ASC
        FOR UPDATE
      `;

      // Verify all requested seats exist
      if (seats.length !== uniqueSeatIds.length) {
        const foundIds = new Set(seats.map((s) => s.id));
        const missingIds = uniqueSeatIds.filter((id) => !foundIds.has(id));
        throw new NotFoundError('Seat', missingIds.join(', '));
      }

      // Verify all seats belong to the same event
      const eventMismatch = seats.some((s) => s.event_id !== eventId);
      if (eventMismatch) {
        throw new ValidationError('All seats must belong to the same event');
      }

      // Check that ALL seats are AVAILABLE — atomic check
      const unavailableSeats = seats.filter((s) => s.status !== SeatStatus.AVAILABLE);
      if (unavailableSeats.length > 0) {
        const seatNumbers = unavailableSeats.map((s) => s.seat_number);
        recordBookingMetric('conflicts');
        logger.info(
          { userId, eventId, unavailableSeats: seatNumbers },
          'Booking conflict — seats unavailable',
        );
        throw new SeatConflictError(seatNumbers);
      }

      // Calculate total
      const totalAmount = seats.reduce((sum, s) => sum + parseFloat(s.price), 0);

      // ─── Payment Processing ──────────────────────────────────────────
      const paymentProvider = getPaymentProvider();
      let paymentIntent: PaymentIntent;

      try {
        const bookingRef = createBookingReference();
        paymentIntent = await paymentProvider.createPayment(bookingRef, totalAmount, 'INR');
      } catch (err) {
        logger.error({ err, userId, eventId }, 'Payment creation failed');
        throw new PaymentError('Payment processing failed. Please try again.');
      }

      // Generate booking reference
      const bookingReference = createBookingReference();

      // Determine payment provider type for DB
      const providerType = config.payment.provider === 'stripe'
        ? PaymentProviderType.STRIPE
        : PaymentProviderType.MOCK;

      // Create booking
      const booking = await tx.booking.create({
        data: {
          userId,
          eventId,
          bookingReference,
          status: config.payment.provider === 'mock'
            ? BookingStatus.CONFIRMED
            : BookingStatus.PENDING,
          totalAmount,
          paymentStatus: config.payment.provider === 'mock'
            ? PaymentStatus.PAID
            : PaymentStatus.PENDING,
        },
      });

      // Create payment record
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          provider: providerType,
          providerPaymentId: paymentIntent.id,
          amount: totalAmount,
          currency: 'INR',
          status: paymentIntent.status === 'succeeded' ? PaymentStatus.PAID : PaymentStatus.PENDING,
        },
      });

      // Create booking items and update seats
      await Promise.all([
        tx.bookingItem.createMany({
          data: seats.map((s) => ({
            bookingId: booking.id,
            seatId: s.id,
            price: parseFloat(s.price),
          })),
        }),
        tx.seat.updateMany({
          where: { id: { in: uniqueSeatIds } },
          data: { status: SeatStatus.BOOKED, bookedBy: userId },
        }),
      ]);

      // Check if event is now sold out
      const availableCount = await tx.seat.count({
        where: { eventId, status: SeatStatus.AVAILABLE },
      });

      if (availableCount === 0) {
        await tx.event.update({
          where: { id: eventId },
          data: { status: 'SOLD_OUT' },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'BOOKING_CONFIRMED',
          entityType: 'booking',
          entityId: booking.id,
          metadata: {
            bookingReference,
            seatCount: seats.length,
            totalAmount,
            paymentId: paymentIntent.id,
          },
        },
      });

      return {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        totalAmount,
        seatCount: seats.length,
        payment: {
          status: paymentIntent.status,
          clientSecret: paymentIntent.clientSecret || undefined,
          provider: config.payment.provider,
        },
      };
    },
    {
      // Transaction timeout — prevent long-held locks
      timeout: 10_000,
      maxWait: 5_000,
    },
  );

  // 5. Post-commit: persist idempotency key in Postgres (authoritative)
  if (idempotencyKey) {
    await persistIdempotencyKey(idempotencyKey, input, result);
  }

  // 6. Post-commit: increment success metric & invalidate event caches
  recordBookingMetric('success');
  await cacheDel(`event:${eventId}:availability`, `event:${eventId}`);
  await bumpEventsListVersion();

  // 7. Queue background jobs (email + analytics)
  try {
    // Fetch user info for email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    if (user && event) {
      const seatData = await prisma.seat.findMany({
        where: { id: { in: uniqueSeatIds } },
        select: { seatNumber: true, row: true, section: true },
      });

      // Queue confirmation email
      await enqueueBookingConfirmationEmail({
        userName: user.name,
        userEmail: user.email,
        bookingReference: result.bookingReference,
        eventName: event.name,
        eventDate: event.eventDate.toISOString().split('T')[0],
        eventTime: `${event.startTime} — ${event.endTime}`,
        venue: event.venue,
        city: event.city,
        seats: seatData,
        totalAmount: result.totalAmount,
      });
    }
  } catch (err) {
    // Background job failure should not affect the booking response
    logger.error({ err }, 'Failed to queue background jobs');
  }

  // 8. Broadcast real-time seat updates via WebSocket
  try {
    broadcastBulkSeatUpdate(
      eventId,
      uniqueSeatIds.map((seatId) => ({
        seatId,
        seatNumber: '', // Frontend will use seatId to update
        status: 'BOOKED',
        eventId,
        bookedBy: userId,
      })),
    );

    // Broadcast updated availability
    const availableNow = await prisma.seat.count({
      where: { eventId, status: SeatStatus.AVAILABLE },
    });
    const totalNow = await prisma.seat.count({ where: { eventId } });
    const bookedNow = await prisma.seat.count({
      where: { eventId, status: SeatStatus.BOOKED },
    });

    broadcastAvailabilityUpdate(eventId, {
      available: availableNow,
      booked: bookedNow,
      total: totalNow,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to broadcast seat updates');
  }

  logger.info(
    { bookingId: result.bookingId, reference: result.bookingReference, userId },
    'Booking completed successfully',
  );

  return result;
}

// ─── Confirm Payment (for Stripe async flow) ────────────────────────────────

export async function confirmPayment(bookingId: string, paymentIntentId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundError('Booking', bookingId);

  const paymentProvider = getPaymentProvider();
  const intent = await paymentProvider.verifyPayment(paymentIntentId);

  if (intent.status === 'succeeded') {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID },
      });
      await tx.payment.update({
        where: { providerPaymentId: paymentIntentId },
        data: { status: PaymentStatus.PAID },
      });
    });

    logger.info({ bookingId, paymentIntentId }, 'Payment confirmed and booking activated');
  }
}

// ─── Cancel Booking ──────────────────────────────────────────────────────────

export async function cancelBooking(bookingId: string, userId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingItems: true,
      event: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
      payments: { select: { providerPaymentId: true, provider: true } },
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking', bookingId);
  }

  if (booking.userId !== userId) {
    throw new ConflictError('You can only cancel your own bookings');
  }

  if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) {
    throw new ConflictError(`Cannot cancel booking in ${booking.status} status`);
  }

  const seatIds = booking.bookingItems.map((item) => item.seatId);

  await prisma.$transaction(async (tx) => {
    // Release seats
    await tx.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: SeatStatus.AVAILABLE, bookedBy: null },
    });

    // Update booking status
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'BOOKING_CANCELLED',
        entityType: 'booking',
        entityId: bookingId,
      },
    });
  });

  // ─── Process Refund (Stripe) ──────────────────────────────────────────
  try {
    const paymentRecord = booking.payments[0];
    if (paymentRecord?.providerPaymentId && booking.paymentStatus === PaymentStatus.PAID) {
      const paymentProvider = getPaymentProvider();
      await paymentProvider.refundPayment(paymentRecord.providerPaymentId);
      logger.info({ bookingId, paymentIntentId: paymentRecord.providerPaymentId }, 'Refund processed');
    }
  } catch (err) {
    logger.error({ err, bookingId }, 'Refund failed — manual review required');
    // Don't throw — booking is cancelled, refund is a separate concern
  }

  // ─── Send Cancellation Email ──────────────────────────────────────────
  try {
    if (booking.user) {
      await enqueueBookingCancellationEmail({
        userName: booking.user.name,
        userEmail: booking.user.email,
        bookingReference: booking.bookingReference,
        eventName: booking.event?.name || 'Unknown Event',
        refundAmount: Number(booking.totalAmount),
      });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to queue cancellation email');
  }

  // ─── Broadcast Seat Release ───────────────────────────────────────────
  try {
    broadcastBulkSeatUpdate(
      booking.eventId,
      seatIds.map((seatId) => ({
        seatId,
        seatNumber: '',
        status: 'AVAILABLE',
        eventId: booking.eventId,
        bookedBy: null,
      })),
    );

    const availableNow = await prisma.seat.count({
      where: { eventId: booking.eventId, status: SeatStatus.AVAILABLE },
    });
    const totalNow = await prisma.seat.count({ where: { eventId: booking.eventId } });
    const bookedNow = await prisma.seat.count({
      where: { eventId: booking.eventId, status: SeatStatus.BOOKED },
    });

    broadcastAvailabilityUpdate(booking.eventId, {
      available: availableNow,
      booked: bookedNow,
      total: totalNow,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to broadcast seat release');
  }

  // Invalidate caches
  await cacheDel(`event:${booking.eventId}:availability`, `event:${booking.eventId}`);
  await bumpEventsListVersion();
  recordBookingMetric('cancellations');

  logger.info({ bookingId, userId }, 'Booking cancelled');
}
