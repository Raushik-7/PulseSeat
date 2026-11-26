import { cacheGet, cacheIncr } from '../../plugins/redis-safe';
import { logger } from '../../utils/logger';

/**
 * Event-list cache versioning.
 *
 * The list cache key embeds the raw query string, so mutations can't know every
 * variant key to delete. Mutations instead bump a version counter that every
 * list read folds into its cache key — instantly invalidating all variants.
 *
 * Redis cost:
 *   bump  = 1 INCR  (was GET + SET: the read-modify-write was half the
 *                     cache traffic on every booking/cancel/admin mutation)
 *   read  = 0 commands for up to VERSION_MEMO_MS, then 1 GET
 *
 * The in-process memo is safe: a bump on another instance is observed within
 * VERSION_MEMO_MS, and cached payloads are already bounded by their own 60s
 * TTL, so worst-case staleness is unchanged in practice.
 */

// New key name (the old `events:list:version` held a JSON-encoded string, which
// INCR would reject as "not an integer"; it simply expires unused).
export const VERSION_KEY = 'events:list:epoch';
const VERSION_MEMO_MS = 5_000;

let memoizedVersion: string | null = null;
let memoExpiresAt = 0;

export async function eventsListVersion(): Promise<string> {
  if (memoizedVersion !== null && Date.now() < memoExpiresAt) return memoizedVersion;

  const v = await cacheGet<string | number>(VERSION_KEY);
  // Redis unavailable → version 0 (short data TTL bounds staleness).
  // Values are written by INCR (raw digits), but tolerate the JSON form.
  const version = v === undefined || v === null ? '0' : String(v);

  memoizedVersion = version;
  memoExpiresAt = Date.now() + VERSION_MEMO_MS;
  return version;
}

export async function bumpEventsListVersion(): Promise<void> {
  // Local bump is visible to this process immediately; other instances pick it
  // up when their memo expires.
  const next = await cacheIncr(VERSION_KEY);
  if (next !== undefined) {
    memoizedVersion = String(next);
    memoExpiresAt = Date.now() + VERSION_MEMO_MS;
    return;
  }

  // Redis unavailable: forget the memo so the next read at least re-checks.
  memoizedVersion = null;
  memoExpiresAt = 0;
  logger.warn('Could not bump events list cache version (Redis unavailable) — relying on 60s data TTL');
}
