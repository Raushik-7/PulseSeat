import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { logger } from '../../utils/logger';

/**
 * Health endpoints — three tiers:
 *
 * /health        — process liveness only (no dependencies). Use for Render's
 *                  health check path or any monitoring that should page on a
 *                  dead process.
 * /health/ready  — TRUE readiness: Postgres only. Public event browsing only
 *                  truly needs the database; Redis is an optional cache that
 *                  the data paths degrade without (see plugins/redis-safe.ts).
 *                  This endpoint performs ONE cheap indexed count — no Redis
 *                  commands, so a probe storm can never burn Upstash quota and
 *                  cache outages can never mark a healthy service "down"
 *                  (UptimeRobot watches this endpoint).
 * /health/deps   — Full dependency report (Postgres + up to 2 Redis probes +
 *                  queue summary). query=1 optionally includes Postgres query
 *                  latency. NOT for frequent monitoring — use for manual
 *                  incident diagnosis.
 */

export async function healthRoutes(app: FastifyInstance) {
  // GET /health — Process liveness
  app.get('/health', async (_request, reply) => {
    reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // GET /health/live — Liveness probe (alias)
  app.get('/health/live', async (_request, reply) => {
    reply.send({ status: 'alive' });
  });

  // GET /health/ready — Readiness: Postgres reachable AND serving data
  app.get('/health/ready', async (_request, reply) => {
    try {
      const start = Date.now();
      // Cheap real read (uses the status index) — proves data is servable,
      // not just that the connection accepts queries.
      const eventCount = await prisma.event.count({ where: { status: 'PUBLISHED' } });
      const latencyMs = Date.now() - start;
      reply.send({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: { postgres: { status: 'healthy', latencyMs }, publishedEvents: eventCount },
      });
    } catch (err: any) {
      logger.error({ errMessage: err?.message ?? String(err) }, 'Readiness check failed: Postgres unhealthy');
      reply.status(503).send({
        status: 'unavailable',
        timestamp: new Date().toISOString(),
        checks: { postgres: { status: 'unhealthy' } },
      });
    }
  });

  // GET /health/deps — Deep dependency report (for manual diagnosis)
  app.get('/health/deps', async (_request, reply) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err: any) {
      checks.postgres = { status: 'unhealthy', error: err?.message ?? 'unknown' };
    }

    try {
      const { getRedis } = await import('../../plugins/redis');
      const redis = getRedis();
      // At most 2 commands per deep check (PINGS on pipelined connections).
      const pipeline = redis.pipeline();
      pipeline.ping();
      pipeline.ping();
      const results = await pipeline.exec() as Array<[null | Error, unknown]>;
      const failing = results.filter(([, res]) => res instanceof Error).length;
      checks.redis = failing > 0 ? { status: 'unhealthy', error: `${failing} of 2 ping(s) failed` } : { status: 'healthy' };
    } catch (err: any) {
      checks.redis = { status: 'unhealthy', error: err?.message ?? 'unknown' };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
    reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
