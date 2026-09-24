import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { getPaymentProvider } from './payments.service';
import { prisma } from '../../plugins/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const createPaymentSchema = z.object({
  bookingId: z.string().min(1),
});

export async function paymentsRoutes(app: FastifyInstance) {
  // POST /api/v1/payments/create-intent — Create a Stripe PaymentIntent
  app.post('/api/v1/payments/create-intent', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    const body = createPaymentSchema.parse(request.body);

    // Verify booking belongs to user and is pending payment
    const booking = await prisma.booking.findFirst({
      where: { id: body.bookingId, userId: user.id },
    });

    if (!booking) throw new NotFoundError('Booking', body.bookingId);

    if (booking.paymentStatus === 'PAID') {
      reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'This booking has already been paid for.' },
      });
      return;
    }

    const paymentProvider = getPaymentProvider();
    const intent = await paymentProvider.createPayment(
      booking.id,
      Number(booking.totalAmount),
      'INR',
    );

    logger.info({ bookingId: booking.id, paymentIntentId: intent.id }, 'Payment intent created');

    reply.send({
      success: true,
      data: {
        clientSecret: intent.id, // In mock mode this is the mock ID
        paymentIntentId: intent.id,
        amount: intent.amount,
      },
    });
  });

  // POST /api/v1/payments/confirm — Confirm a payment
  app.post('/api/v1/payments/confirm', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    const body = z.object({ bookingId: z.string(), paymentIntentId: z.string() }).parse(request.body);

    const booking = await prisma.booking.findFirst({
      where: { id: body.bookingId, userId: user.id },
    });

    if (!booking) throw new NotFoundError('Booking', body.bookingId);

    const { confirmPayment } = await import('../bookings/booking.service');
    await confirmPayment(body.bookingId, body.paymentIntentId);

    reply.send({ success: true, message: 'Payment confirmed' });
  });
}
