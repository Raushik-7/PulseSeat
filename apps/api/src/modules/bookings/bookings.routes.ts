import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { requireAuth } from '../../middleware/auth';
import { createBooking, cancelBooking } from './booking.service';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const createBookingSchema = z.object({
  eventId: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1).max(10),
});

export async function bookingsRoutes(app: FastifyInstance) {
  // POST /api/v1/bookings — Create a booking (the concurrency-critical endpoint)
  app.post('/api/v1/bookings', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    const body = createBookingSchema.parse(request.body);
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    try {
      const result = await createBooking({
        userId: user.id,
        eventId: body.eventId,
        seatIds: body.seatIds,
        idempotencyKey,
      });

      reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      // Specific error handling for booking conflicts
      if (err.code === 'SEAT_ALREADY_BOOKED' || err.statusCode === 409) {
        reply.status(409).send({
          success: false,
          error: {
            code: err.code || 'SEAT_CONFLICT',
            message: err.message,
          },
        });
        return;
      }
      throw err;
    }
  });

  // GET /api/v1/bookings — List user's bookings
  app.get('/api/v1/bookings', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as Record<string, string>;
    const status = query.status as string | undefined;

    const where: any = { userId: user.id };
    if (status) where.status = status;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        event: {
          select: { id: true, name: true, slug: true, venue: true, city: true, eventDate: true, startTime: true, bannerUrl: true },
        },
        bookingItems: {
          include: {
            seat: {
              select: { seatNumber: true, row: true, section: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    reply.send({ success: true, data: bookings });
  });

  // GET /api/v1/bookings/:id — Get booking detail
  app.get('/api/v1/bookings/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const booking = await prisma.booking.findFirst({
      where: { id, userId: user.id },
      include: {
        event: {
          select: { id: true, name: true, slug: true, venue: true, city: true, eventDate: true, startTime: true, endTime: true, bannerUrl: true },
        },
        bookingItems: {
          include: {
            seat: {
              select: { seatNumber: true, row: true, section: true },
            },
          },
        },
        payments: true,
      },
    });

    if (!booking) throw new NotFoundError('Booking', id);

    reply.send({ success: true, data: booking });
  });

  // POST /api/v1/bookings/:id/cancel — Cancel a booking
  app.post('/api/v1/bookings/:id/cancel', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    await cancelBooking(id, user.id);

    reply.send({ success: true, message: 'Booking cancelled successfully' });
  });
}
