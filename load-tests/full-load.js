// ─── PulseSeat Full Load Test: staged ramp to 5,000 concurrent virtual users ─
// Stages: 100 → 500 → 1,000 → 2,500 → 5,000 VUs, each sustained, then ramp-down.
// Mixed realistic traffic (browse/search/detail/seats) identical to browse.js.
//
// Usage:
//   k6 run load-tests/full-load.js
//   k6 run load-tests/full-load.js -e MAX_VUS=1000      (reduced target)
//   k6 run load-tests/full-load.js --summary-export=results/raw-full.json
//
// IMPORTANT: raise the API's per-IP rate limit for the test run — k6 comes from
// one IP and the default general limit (100 req/min) would throttle it.
// Start the API with RATE_LIMIT_GENERAL=1000000 (see load-tests/README.md).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, SEARCH_TERMS, CATEGORIES, CITIES, seededVU } from './config.js';

const browseLatency = new Trend('browse_latency', true);
const searchLatency = new Trend('search_latency', true);
const detailLatency = new Trend('event_detail_latency', true);
const seatAvailLatency = new Trend('seat_availability_latency', true);
const errorRate = new Rate('scenario_errors');

const MAX_VUS = parseInt(__ENV.MAX_VUS || '5000', 10);
const SUSTAIN = __ENV.SUSTAIN || '2m'; // time held at each stage

// Stage list trimmed to everything <= MAX_VUS
const ALL_STAGES = [100, 500, 1000, 2500, 5000];
const stages = [];
for (const target of ALL_STAGES) {
  stages.push({ duration: '45s', target });   // ramp up
  stages.push({ duration: SUSTAIN, target }); // hold
}
stages.push({ duration: '30s', target: Math.round(MAX_VUS / 2) });
stages.push({ duration: '30s', target: 0 });

export const options = {
  scenarios: {
    full_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // No hard abort thresholds — we want to OBSERVE degradation, not stop early.
    http_req_failed: ['rate<0.5'],
  },
  setupTimeout: '60s',
  // Windows: raise k6's own buffers to avoid generator-side errors
  noConnectionReuse: false,
  userAgent: 'PulseSeat-k6/1.0',
};

export default function () {
  const vu = __VU;
  const roll = seededVU(vu, 100);

  if (roll < 40) {
    const page = 1 + seededVU(vu + 7, 2);
    const res = http.get(`${BASE_URL}/api/v1/events?limit=12&page=${page}`);
    browseLatency.add(res.timings.duration);
    if (!check(res, { 'browse 200': (r) => r.status === 200 })) errorRate.add(1);
    sleep(2 + seededVU(vu + 3, 30) / 10);

    try {
      const events = res.json().data;
      if (events && events.length) {
        const ev = events[seededVU(vu + 11, events.length)];
        const d = http.get(`${BASE_URL}/api/v1/events/${ev.id}`);
        detailLatency.add(d.timings.duration);
        if (!check(d, { 'browse->detail 200': (r) => r.status === 200 })) errorRate.add(1);
      }
    } catch (_) { /* non-fatal */ }
    sleep(3 + seededVU(vu + 5, 40) / 10);
  } else if (roll < 60) {
    const term = SEARCH_TERMS[seededVU(vu + 13, SEARCH_TERMS.length)];
    const useCity = seededVU(vu + 17, 10) < 4;
    const city = CITIES[seededVU(vu + 19, CITIES.length)];
    const category = CATEGORIES[seededVU(vu + 23, CATEGORIES.length)];
    const q = useCity
      ? `search=${encodeURIComponent(term)}&city=${encodeURIComponent(city)}`
      : `category=${category}&search=${encodeURIComponent(term)}`;
    const res = http.get(`${BASE_URL}/api/v1/events?${q}`);
    searchLatency.add(res.timings.duration);
    if (!check(res, { 'search 200': (r) => r.status === 200 })) errorRate.add(1);
    sleep(2 + seededVU(vu + 29, 30) / 10);
  } else if (roll < 80) {
    const page = 1 + seededVU(vu + 31, 2);
    const list = http.get(`${BASE_URL}/api/v1/events?limit=12&page=${page}`);
    if (!check(list, { 'detail.list 200': (r) => r.status === 200 })) errorRate.add(1);
    try {
      const events = list.json().data;
      const ev = events[seededVU(vu + 37, events.length)];
      const res = http.get(`${BASE_URL}/api/v1/events/${ev.id}`);
      detailLatency.add(res.timings.duration);
      if (!check(res, { 'detail 200': (r) => r.status === 200 })) errorRate.add(1);
    } catch (_) { errorRate.add(1); }
    sleep(4 + seededVU(vu + 41, 50) / 10);
  } else {
    try {
      const list = http.get(`${BASE_URL}/api/v1/events?limit=12&page=1`);
      const events = list.json().data;
      const ev = events[seededVU(vu + 43, events.length)];
      const seats = http.get(`${BASE_URL}/api/v1/events/${ev.id}/seats`);
      seatAvailLatency.add(seats.timings.duration);
      if (!check(seats, { 'seats 200': (r) => r.status === 200 })) errorRate.add(1);
      const avail = http.get(`${BASE_URL}/api/v1/events/${ev.id}/availability`);
      seatAvailLatency.add(avail.timings.duration);
      if (!check(avail, { 'availability 200': (r) => r.status === 200 })) errorRate.add(1);
    } catch (_) { errorRate.add(1); }
    sleep(1 + seededVU(vu + 47, 20) / 10);
  }
}
