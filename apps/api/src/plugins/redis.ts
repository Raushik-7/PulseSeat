import Redis from 'ioredis';
import { config } from '../config/index';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('Redis connected');
    });
  }
  return redis;
}

/**
 * Create a Redis connection suitable for BullMQ.
 * BullMQ requires maxRetriesPerRequest: null.
 */
export function getBullMQConnection(): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
