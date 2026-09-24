// ─── Concurrent Seat Booking + Contention Test ──────────────────────────────
// Two modes:
//   contention: N VUs race for the SAME limited pool of seats (default 20 seats).
//               Expected: exactly `pool` successes, everything else 409 CONFLICT.
//   flow:       each VU books its own unique seats (throughput measurement).
// Usage:
//   k6 run load-tests/booking.js -e MODE=contention -e VUS=100 -e POOL=20
//   k6 run load-tests/booking.js -e MODE=flow -e VUS=50

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import {
  BASE_URL, LOAD_USER_PASSWORD, login, resolveTestEvent, fetchSeatIds, jsonHeaders,
} from './config.js';

const bookingLatency = new Trend('booking_latency', true);
const bookingSuccessRate = new Rate('booking_success');
const bookingConflictRate = new Rate('booking_conflict');
const bookingOtherFailRate = new Rate('booking_other_failure');
const seatsBooked = new Counter('seats_booked');

const MODE = __ENV.MODE || 'contention';
const VUS = parseInt(__ENV.VUS || '100', 10);
const POOL = parseInt(__ENV.POOL || '20', 10);

export const options = {
  scenarios: {
    booking: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: parseInt(__ENV.ITERATIONS || '1', 10),
      maxDuration: '5m',
    },
  },
  thresholds: {
    booking_conflict: MODE === 'contention' ? ['rate>0'] : [],
  },
};

let token;         // resolved in setup, per-run
let eventId;
let seatPool = []; // contention mode: shared pool
let mySeats = {};  // flow mode: per-VU unique seats (assigned via index)

export function setup() {
  const ev = resolveTestEvent();
  const seats = fetchSeatIds(ev.eventId, MODE === 'contention' ? POOL : VUS * 2);
  if (MODE === 'contention' && seats.length < POOL) {
    throw new Error(`not enough available seats (${seats.length}) for pool of ${POOL}`);
  }
  if (MODE === 'flow' && seats.length < VUS) {
    throw new Error(`not enough available seats (${seats.length}) for ${VUS} VUs`);
  }
  return { eventId: ev.eventId, eventName: ev.eventName, seatIds: seats };
}

export default function (data) {
  const vu = __VU;
  if (!token) token = login(`load${(vu - 1) % 600}@loadtest.local`);
  const authHeaders = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };

  let seatIds;
  if (MODE === 'contention') {
    // Every VU races for the SAME first seat of the pool — worst case contention
    seatIds = [data.seatIds[0]];
  } else {
    // flow mode: unique seat per VU
    seatIds = [data.seatIds[(vu - 1) % data.seatIds.length]];
  }

  const res = http.post(
    `${BASE_URL}/api/v1/bookings`,
    JSON.stringify({ eventId: data.eventId, seatIds }),
    authHeaders,
  );

  bookingLatency.add(res.timings.duration);
  const body = res.json ? safeJson(res) : {};

  if (res.status === 201 || res.status === 200) {
    bookingSuccessRate.add(1);
    bookingConflictRate.add(0);
    bookingOtherFailRate.add(0);
    seatsBooked.add(seatIds.length);
    check(res, { 'booking 201': (r) => r.status === 201 });
  } else if (res.status === 409) {
    bookingSuccessRate.add(0);
    bookingConflictRate.add(1);
    bookingOtherFailRate.add(0);
    check(res, { 'conflict 409': (r) => r.status === 409 });
  } else {
    bookingSuccessRate.add(0);
    bookingConflictRate.add(0);
    bookingOtherFailRate.add(1);
    check(res, { 'unexpected status': (r) => false });
    console.error(`VU${vu} booking failed: ${res.status} ${res.body}`);
  }
}

function safeJson(res) {
  try { return res.json(); } catch (_) { return {}; }
}
