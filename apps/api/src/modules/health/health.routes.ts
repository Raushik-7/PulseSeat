import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { pingRedis } from '../../plugins/redis-safe';
import { getEmailOutboxStats } from '../email/email.outbox';
import { logger } from '../../utils/logger';

/**
 * Health endpoints — four tiers, deliberately separated so a keep-alive or
 * uptime monitor can never burn Redis quota or page on an optional dependency.
 *
 * /health        — process liveness only (no dependencies, no Redis).
 * /health/live   — liveness alias.
 * /health/ready  — readiness: Postgres only (one indexed count). This is what
 *                  the external keep-alive and Render's health check should
 *                  use: ZERO Redis commands. Public browsing only truly needs
 *                  the database; Redis is an optional cache.
 * /health/deps   — manual incident diagnosis only: Postgres, ONE breaker-aware
 *                  Redis PING, and email-outbox depth. Not for frequent polling.
 *
 * Redis being unavailable reports `degraded` but never makes readiness fail:
 * a cache outage must not mark a healthy service "down".
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
    const checks: Record<string, unknown> = {};

    let postgresHealthy = false;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { status: 'healthy', latencyMs: Date.now() - start };
      postgresHealthy = true;
    } catch (err: any) {
      checks.postgres = { status: 'unhealthy', error: err?.message ?? 'unknown' };
    }

    // At most ONE PING, skipped entirely while the breaker is open.
    const redis = await pingRedis();
    checks.redis = redis;

    try {
      checks.emailOutbox = await getEmailOutboxStats();
    } catch {
      checks.emailOutbox = { status: 'unknown' };
    }

    // Only Postgres decides the status code — it is the sole hard dependency.
    reply.status(postgresHealthy ? 200 : 503).send({
      status: postgresHealthy && redis.status === 'ok' ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
