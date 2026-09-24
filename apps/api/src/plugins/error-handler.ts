import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;

    // Zod validation errors
    if (error instanceof ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: messages.join('; '),
        },
        requestId,
      });
      return;
    }

    // Application errors
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        requestId,
      });
      return;
    }

    // Fastify 404
    if (error.statusCode === 404) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
        requestId,
      });
      return;
    }

    // Rate limit errors from @fastify/rate-limit
    if (error.statusCode === 429) {
      reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
        requestId,
      });
      return;
    }

    // Unknown errors — don't expose internals
    logger.error({ err: error, requestId }, 'Unhandled error');

    reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
      requestId,
    });
  });
}
