import Fastify from 'fastify';
import cors from '@fastify/cors';
import { isOriginAllowed } from './config/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index';
import { prisma } from './plugins/prisma';
import { getRedis, closeRedis } from './plugins/redis';
import { logger } from './utils/logger';
import { errorHandler } from './plugins/error-handler';
import { authRoutes } from './modules/auth/auth.routes';
import { eventsRoutes } from './modules/events/events.routes';
import { seatsRoutes } from './modules/seats/seats.routes';
import { bookingsRoutes } from './modules/bookings/bookings.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { healthRoutes } from './modules/health/health.routes';
import { paymentsRoutes } from './modules/payments/payments.routes';
import { initWebSocket } from './plugins/websocket';
import { startEmailWorker, closeQueues } from './modules/email/email.worker';

const app = Fastify({
  logger: config.isDev,
  bodyLimit: 1048576, // 1MB
});

async function start() {
  // ─── Plugins ─────────────────────────────────────────────────────────────

  await app.register(cors, {
    // Env-driven origins (CORS_ORIGINS / NEXT_PUBLIC_APP_URL / *.vercel.app).
    // Previously hardcoded to https://pulseseat.dev in production, which broke
    // any Vercel-hosted frontend.
    origin: isOriginAllowed,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: config.rateLimit.general,
    timeWindow: config.rateLimit.windowMs,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    }),
  });

  // ─── Request ID tracking ─────────────────────────────────────────────────

  app.addHook('onRequest', async (request) => {
    request.id = request.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  });

  // ─── Routes ──────────────────────────────────────────────────────────────

  // Invoke directly (NOT app.register) so setErrorHandler applies to the root
  // scope — as an encapsulated plugin, sibling route plugins never inherit it.
  await errorHandler(app);
  await app.register(authRoutes);
  await app.register(eventsRoutes);
  await app.register(seatsRoutes);
  await app.register(bookingsRoutes);
  await app.register(adminRoutes);
  await app.register(paymentsRoutes);
  await app.register(healthRoutes);

  // ─── Stripe Webhook Endpoint ─────────────────────────────────────────────
  // Must be registered before JSON parsing so raw body is available

  app.post('/api/v1/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    if (!sig) {
      reply.status(400).send({ error: 'Missing stripe-signature header' });
      return;
    }

    try {
      // In production, you'd use the raw body here.
      // For now, we log the webhook event and handle it.
      const body = request.body as any;
      logger.info({ type: body?.type, id: body?.id }, 'Stripe webhook received');

      // Handle specific events
      if (body?.type === 'payment_intent.succeeded') {
        const paymentIntent = body.data?.object;
        if (paymentIntent?.id) {
          const { confirmPayment } = await import('./modules/bookings/booking.service');
          const bookingId = paymentIntent.metadata?.bookingId;
          if (bookingId) {
            await confirmPayment(bookingId, paymentIntent.id);
          }
        }
      }

      reply.status(200).send({ received: true });
    } catch (err) {
      logger.error({ err }, 'Stripe webhook error');
      reply.status(400).send({ error: 'Webhook error' });
    }
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (_request, reply) => {
    const redis = getRedis();
    const [attempts, success, conflicts, cancellations] = await Promise.all([
      redis.get('metrics:booking:attempts'),
      redis.get('metrics:booking:success'),
      redis.get('metrics:booking:conflicts'),
      redis.get('metrics:booking:cancellations'),
    ]);

    const metrics = [
      '# HELP booking_attempts_total Total booking attempts',
      '# TYPE booking_attempts_total counter',
      `booking_attempts_total ${attempts || 0}`,
      '',
      '# HELP booking_success_total Successful bookings',
      '# TYPE booking_success_total counter',
      `booking_success_total ${success || 0}`,
      '',
      '# HELP booking_conflicts_total Booking conflicts (double-booking attempts)',
      '# TYPE booking_conflicts_total counter',
      `booking_conflicts_total ${conflicts || 0}`,
      '',
      '# HELP booking_cancellations_total Booking cancellations',
      '# TYPE booking_cancellations_total counter',
      `booking_cancellations_total ${cancellations || 0}`,
    ].join('\n');

    reply.header('Content-Type', 'text/plain');
    reply.send(metrics);
  });

  // ─── Start Server ────────────────────────────────────────────────────────

  try {
    // Connect to Redis
    const redis = getRedis();
    await redis.connect();
    logger.info('Redis connected');

    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL connected');

    // Initialize WebSocket gateway
    initWebSocket(app);

    // Start email worker (BullMQ)
    startEmailWorker();

    await app.listen({ port: config.port, host: config.host });
    logger.info(`🚀 PulseSeat API running on http://${config.host}:${config.port}`);
    logger.info(`🔌 WebSocket available at ws://${config.host}:${config.port}/ws`);
    logger.info(`💳 Payment provider: ${config.payment.provider}`);
    logger.info(`📧 Email service: ${config.email.host ? 'SMTP configured' : 'Console only (dev mode)'}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    await closeQueues();
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
