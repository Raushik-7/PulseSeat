// ─── CORS origin policy ──────────────────────────────────────────────────────
//
// Production deployments (e.g. frontend on Vercel, API on Railway/Render/Fly)
// must declare their frontend origins via CORS_ORIGINS (comma-separated):
//
//   CORS_ORIGINS=https://pulseseat.vercel.app,https://pulseseat.example.com
//
// NEXT_PUBLIC_APP_URL (the frontend URL used in email links) is always allowed
// automatically, and any https://*.vercel.app origin (production or preview
// deployments) is accepted so the frontend works before custom domains exist.
// In development every origin is reflected (matches the previous `origin: true`).
//
// Callback style is REQUIRED: @fastify/cors v10 and the cors package used by
// Socket.io both ignore synchronous return values from origin functions.

import { config } from './index';

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  // Explicit list wins: CORS_ORIGINS=a,b,c
  if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean)
      .forEach((o) => origins.add(o));
  }

  // The frontend URL (used for email links) is always a valid origin.
  if (config.appUrl) origins.add(config.appUrl.replace(/\/$/, ''));

  return Array.from(origins);
}

const VERCEL_ORIGIN = /^https:\/\/[\w-]+(\.[\w-]+)*\.vercel\.app$/;

type OriginCallback = (
  err: Error | null,
  origin: string | boolean | RegExp,
) => void;

/**
 * Origin validator for @fastify/cors and Socket.io.
 * Resolves to the request origin (reflected) when allowed, or `false` to
 * withhold CORS headers (browser rejects the request).
 */
export function isOriginAllowed(
  origin: string | undefined,
  callback: OriginCallback,
): void {
  if (!origin) {
    // Non-browser / same-origin requests don't need CORS headers.
    callback(null, false);
    return;
  }

  if (config.isDev) {
    callback(null, origin); // dev: reflect anything (localhost ports vary)
    return;
  }

  const normalized = origin.replace(/\/$/, '');
  const allowed =
    getAllowedOrigins().includes(normalized) || VERCEL_ORIGIN.test(normalized);

  callback(null, allowed ? origin : false);
}
