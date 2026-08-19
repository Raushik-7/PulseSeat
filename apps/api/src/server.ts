import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { prisma } from './plugins/prisma.js';
import { getRedis } from './plugins/redis.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './plugins/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { eventsRoutes } from './modules/events/events.routes.js';
import { seatsRoutes } from './modules/seats/seats.routes.js';
import { bookingsRoutes } from './modules/bookings/bookings.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';

const app = Fastify({
  logger: config.isDev,
  requestLogging: true,
  bodyLimit: 1048576, // 1MB
});

async function start() {
  // ─── Plugins ─────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: config.isDev ? true : [config.nodeEnv === 'production' ? 'https://pulseseat.dev' : 'http://localhost:3000'],
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

  await app.register(errorHandler);
  await app.register(authRoutes);
  await app.register(eventsRoutes);
  await app.register(seatsRoutes);
  await app.register(bookingsRoutes);
  await app.register(adminRoutes);
  await app.register(healthRoutes);

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
    // Connect to dependencies
    const redis = getRedis();
    await redis.connect();
    logger.info('Redis connected');

    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL connected');

    await app.listen({ port: config.port, host: config.host });
    logger.info(`🚀 PulseSeat API running on http://${config.host}:${config.port}`);
    logger.info(`📚 API docs at http://${config.host}:${config.port}/api/docs`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    await prisma.$disconnect();
    const { closeRedis } = await import('./plugins/redis.js');
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
