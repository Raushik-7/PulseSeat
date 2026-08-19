import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.isDev ? 'debug' : 'info',
  transport: config.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  serializers: {
    req(request) {
      return {
        method: request.method,
        url: request.url,
        id: request.id,
      };
    },
    res(reply) {
      return {
        statusCode: reply.statusCode,
      };
    },
  },
});
