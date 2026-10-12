import { cacheGet, cacheSet } from '../../plugins/redis-safe';
import { logger } from '../../utils/logger';

/**
 * Event-list cache versioning.
 *
 * The list cache key embeds the raw query string, so mutations can't know
 * every variant key to delete. Mutations instead bump a version counter that
 * every list read folds into its cache key — instantly invalidating all
 * variants. Falls back to version 0 (short 60s TTL bounds staleness) if Redis
 * is unavailable.
 */

export async function eventsListVersion(): Promise<string> {
  try {
    const v = await cacheGet<string>('events:list:version');
    return v || '0';
  } catch {
    return '0';
  }
}

export async function bumpEventsListVersion(): Promise<void> {
  try {
    const current = await eventsListVersion();
    const next = String(parseInt(current, 10) + 1);
    await cacheSet('events:list:version', next, 86_400);
  } catch (err) {
    logger.warn({ err }, 'Could not bump events list cache version');
  }
}
