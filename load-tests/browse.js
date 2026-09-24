// ─── Scenarios A+B+C+D: Browse / Search / Event Detail / Seat Availability ──
// Realistic mixed read traffic: ~40% browse, ~20% search, ~20% detail, ~20% seats.
// Usage: k6 run load-tests/browse.js [-e STAGE=500] [-e DURATION=60s]

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, SEARCH_TERMS, CATEGORIES, CITIES, seededVU } from './config.js';

const browseLatency = new Trend('browse_latency', true);
const searchLatency = new Trend('search_latency', true);
const detailLatency = new Trend('event_detail_latency', true);
const seatAvailLatency = new Trend('seat_availability_latency', true);
const errorRate = new Rate('scenario_errors');

const STAGE = parseInt(__ENV.STAGE || '100', 10);
const DURATION = __ENV.DURATION || '60s';

export const options = {
  scenarios: {
    mixed_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: STAGE },
        { duration: DURATION, target: STAGE },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
  // k6 defaults may under-allocate for high stages on Windows
  setupTimeout: '60s',
};

export default function () {
  const vu = __VU;
  const roll = seededVU(vu, 100);

  if (roll < 40) {
    // ── Scenario A: Event browsing ────────────────────────────────────────
    const page = 1 + (seededVU(vu + 7, 2));
    const res = http.get(`${BASE_URL}/api/v1/events?limit=12&page=${page}`);
    browseLatency.add(res.timings.duration);
    const ok = check(res, { 'browse 200': (r) => r.status === 200 });
    if (!ok) errorRate.add(1);
    sleep(2 + (seededVU(vu + 3, 30)) / 10);

    // Follow into a detail page like a real user would
    try {
      const events = res.json().data;
      if (events && events.length) {
        const ev = events[seededVU(vu + 11, events.length)];
        const d = http.get(`${BASE_URL}/api/v1/events/${ev.id}`);
        detailLatency.add(d.timings.duration);
        if (!check(d, { 'browse->detail 200': (r) => r.status === 200 })) errorRate.add(1);
      }
    } catch (_) { /* non-fatal */ }
    sleep(3 + (seededVU(vu + 5, 40)) / 10);
  } else if (roll < 60) {
    // ── Scenario B: Search ────────────────────────────────────────────────
    const term = SEARCH_TERMS[seededVU(vu + 13, SEARCH_TERMS.length)];
    const useCity = seededVU(vu + 17, 10) < 4;
    const city = CITIES[seededVU(vu + 19, CITIES.length)];
    const category = CATEGORIES[seededVU(vu + 23, CATEGORIES.length)];
    const q = useCity
      ? `search=${encodeURIComponent(term)}&city=${encodeURIComponent(city)}`
      : `category=${category}&search=${encodeURIComponent(term)}`;
    const res = http.get(`${BASE_URL}/api/v1/events?${q}`);
    searchLatency.add(res.timings.duration);
    const ok = check(res, { 'search 200': (r) => r.status === 200 });
    if (!ok) errorRate.add(1);

    // Open first search result
    try {
      const events = res.json().data;
      if (events && events.length) {
        const d = http.get(`${BASE_URL}/api/v1/events/${events[0].id}`);
        detailLatency.add(d.timings.duration);
        if (!check(d, { 'search->detail 200': (r) => r.status === 200 })) errorRate.add(1);
      }
    } catch (_) { /* non-fatal */ }
    sleep(2 + (seededVU(vu + 29, 30)) / 10);
  } else if (roll < 80) {
    // ── Scenario C: Event details ─────────────────────────────────────────
    const page = 1 + seededVU(vu + 31, 2);
    const list = http.get(`${BASE_URL}/api/v1/events?limit=12&page=${page}`);
    if (!check(list, { 'detail.list 200': (r) => r.status === 200 })) errorRate.add(1);
    try {
      const events = list.json().data;
      const ev = events[seededVU(vu + 37, events.length)];
      const res = http.get(`${BASE_URL}/api/v1/events/${ev.id}`);
      detailLatency.add(res.timings.duration);
      const ok = check(res, { 'detail 200': (r) => r.status === 200 });
      if (!ok) errorRate.add(1);
    } catch (_) { errorRate.add(1); }
    sleep(4 + (seededVU(vu + 41, 50)) / 10);
  } else {
    // ── Scenario D: Seat availability polling ─────────────────────────────
    try {
      const list = http.get(`${BASE_URL}/api/v1/events?limit=12&page=1`);
      const events = list.json().data;
      const ev = events[seededVU(vu + 43, events.length)];
      // Full seat map (uncached DB read) and availability summary (10s cache)
      const seats = http.get(`${BASE_URL}/api/v1/events/${ev.id}/seats`);
      seatAvailLatency.add(seats.timings.duration);
      if (!check(seats, { 'seats 200': (r) => r.status === 200 })) errorRate.add(1);
      const avail = http.get(`${BASE_URL}/api/v1/events/${ev.id}/availability`);
      seatAvailLatency.add(avail.timings.duration);
      if (!check(avail, { 'availability 200': (r) => r.status === 200 })) errorRate.add(1);
    } catch (_) { errorRate.add(1); }
    // Seat-checkers poll frequently
    sleep(1 + (seededVU(vu + 47, 20)) / 10);
  }
}
