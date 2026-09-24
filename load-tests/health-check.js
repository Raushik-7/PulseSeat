// ─── Pre-flight health check — run before any load test ─────────────────────
// Usage: k6 run load-tests/health-check.js

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, resolveTestEvent } from './config.js';

export const options = { vus: 1, iterations: 1 };

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'api /health 200': (r) => r.status === 200 });

  const events = http.get(`${BASE_URL}/api/v1/events?limit=12`);
  check(events, { 'events list 200': (r) => r.status === 200 });
  const total = events.json().pagination?.total ?? 0;
  console.log(`API OK — ${total} events published`);

  const ev = resolveTestEvent();
  console.log(`Booking test event: ${ev.eventName} (${ev.eventId}) — ${ev.availableSeats} seats available`);
}
