import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { getRedis } from '../../plugins/redis';
import { logger } from '../../utils/logger';

export async function healthRoutes(app: FastifyInstance) {
  // GET /health — Basic health check
  app.get('/health', async (_request, reply) => {
    reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // GET /health/live — Liveness probe
  app.get('/health/live', async (_request, reply) => {
    reply.send({ status: 'alive' });
  });

  // GET /health/ready — Readiness probe (checks dependencies)
  app.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // PostgreSQL check
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err: any) {
      checks.postgres = { status: 'unhealthy', error: err.message };
    }

    // Redis check
    try {
      const redis = getRedis();
      const start = Date.now();
      await redis.ping();
      checks.redis = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err: any) {
      checks.redis = { status: 'unhealthy', error: err.message };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

    const response = {
      status: allHealthy ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };

    reply.status(allHealthy ? 200 : 503).send(response);
  });
}
