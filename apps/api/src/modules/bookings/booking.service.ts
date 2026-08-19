import { PrismaClient, SeatStatus, BookingStatus, PaymentStatus } from '@prisma/client';
import { createIdempotencyKey } from '../utils/booking-reference.js';
import { SeatConflictError, ConflictError, ValidationError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getRedis } from '../plugins/redis.js';
import { config } from '../config/index.js';

const prisma = new PrismaClient();

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BookSeatsInput {
  userId: string;
  eventId: string;
  seatIds: string[];
  idempotencyKey?: string;
}

export interface BookingResult {
  bookingId: string;
  bookingReference: string;
  totalAmount: number;
  seatCount: number;
}

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
//   6. Create booking record
//   7. Update seat status to BOOKED
//   8. COMMIT
//   9. Queue background jobs
//  10. Return success
//
// If any step fails, the transaction is rolled back completely.
// No partial bookings are ever created.

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

  // 2. Check idempotency
  if (idempotencyKey) {
    const redis = getRedis();
    const existing = await redis.get(`idempotency:${idempotencyKey}`);
    if (existing) {
      const parsed = JSON.parse(existing);
      logger.info({ idempotencyKey, bookingId: parsed.bookingId }, 'Idempotent request - returning cached result');
      return parsed;
    }
  }

  // 3. Increment booking attempt metric
  const redis = getRedis();
  await redis.incr('metrics:booking:attempts');

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
        await redis.incr('metrics:booking:conflicts');
        logger.info(
          { userId, eventId, unavailableSeats: seatNumbers },
          'Booking conflict - seats unavailable',
        );
        throw new SeatConflictError(seatNumbers);
      }

      // Calculate total
      const totalAmount = seats.reduce((sum, s) => sum + parseFloat(s.price), 0);

      // Generate booking reference
      const { createBookingReference } = await import('../utils/booking-reference.js');
      const bookingReference = createBookingReference();

      // Create booking
      const booking = await tx.booking.create({
        data: {
          userId,
          eventId,
          bookingReference,
          status: BookingStatus.CONFIRMED,
          totalAmount,
          paymentStatus: PaymentStatus.PAID, // Mock payment succeeds
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
          },
        },
      });

      return {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        totalAmount,
        seatCount: seats.length,
      };
    },
    {
      // Transaction timeout — prevent long-held locks
      timeout: 10_000,
      maxWait: 5_000,
    },
  );

  // 5. Post-commit: cache idempotency key
  if (idempotencyKey) {
    await redis.setex(
      `idempotency:${idempotencyKey}`,
      config.booking.idempotencyExpiryS,
      JSON.stringify(result),
    );
  }

  // 6. Post-commit: increment success metric & invalidate cache
  await redis.incr('metrics:booking:success');
  await redis.del(`event:${eventId}:availability`);
  await redis.del(`event:${eventId}`);
  await redis.del('events:list');

  // 7. Queue background jobs (non-critical, fire-and-forget)
  try {
    // In a real system, these would be BullMQ jobs
    logger.info(
      { bookingId: result.bookingId, reference: result.bookingReference },
      'Background jobs queued: confirmation email, invoice, analytics',
    );
  } catch (err) {
    // Background job failure should not affect the booking response
    logger.error({ err }, 'Failed to queue background jobs');
  }

  logger.info(
    { bookingId: result.bookingId, reference: result.bookingReference, userId },
    'Booking completed successfully',
  );

  return result;
}

// ─── Cancel Booking ──────────────────────────────────────────────────────────

export async function cancelBooking(bookingId: string, userId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { bookingItems: true },
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

  await prisma.$transaction(async (tx) => {
    // Release seats
    const seatIds = booking.bookingItems.map((item) => item.seatId);
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

  // Invalidate cache
  const redis = getRedis();
  await redis.del(`event:${booking.eventId}:availability`);
  await redis.del(`event:${booking.eventId}`);
  await redis.incr('metrics:booking:cancellations');
}
