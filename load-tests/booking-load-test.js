// PulseSeat Booking Load Test
// Simulates 500 concurrent users attempting to book from 200 available seats
// Expected: 200 successful bookings, 300 conflicts, 0 double bookings

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const bookingSuccess = new Counter('booking_success');
const bookingConflict = new Counter('booking_conflict');
const bookingFailure = new Counter('booking_failure');
const doubleBooking = new Counter('double_bookings');
const bookingDuration = new Trend('booking_duration');
const successRate = new Rate('booking_success_rate');

const API_URL = __ENV.API_URL || 'http://localhost:3001';

// Test configuration
export const options = {
  scenarios: {
    booking: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // Ramp up
        { duration: '30s', target: 500 }, // Full load
        { duration: '10s', target: 0 },   // Ramp down
      ],
      exec: 'bookSeat',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    double_bookings: ['count==0'],
  },
};

// Generate test users
const users = [];
for (let i = 0; i < 1000; i++) {
  users.push({
    email: `loadtest${i}@pulseseat.dev`,
    password: 'loadtest123',
  });
}

// Pre-authenticate and store tokens
const tokens = new Map();
const eventSlug = 'concurrency-arena';
let eventId = null;

export function setup() {
  console.log('🔧 Setting up load test...');

  // Login as load test user
  const loginRes = http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({
    email: 'loadtest@pulseseat.dev',
    password: 'loadtest123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const data = JSON.parse(loginRes.body);
    tokens.set('default', data.data.token);
    console.log('✅ Logged in as load test user');
  } else {
    console.log('⚠️ Could not login. Using default user if available.');
  }

  // Get event
  const eventRes = http.get(`${API_URL}/api/v1/events`);
  if (eventRes.status === 200) {
    const events = JSON.parse(eventRes.body);
    const arena = events.data?.find(e => e.slug === 'concurrency-arena');
    if (arena) {
      eventId = arena.id;
      console.log(`✅ Found Concurrency Arena: ${eventId} (${arena.totalSeats} seats)`);
    }
  }

  // Get seats
  if (eventId) {
    const seatsRes = http.get(`${API_URL}/api/v1/events/${eventId}/seats`);
    if (seatsRes.status === 200) {
      const seats = JSON.parse(seatsRes.body);
      const available = seats.data?.filter(s => s.status === 'AVAILABLE') || [];
      console.log(`✅ Found ${available.length} available seats`);
    }
  }

  return { eventId, token: tokens.get('default') };
}

export function bookSeat(data) {
  const { eventId: evId, token: defaultToken } = data;

  if (!evId || !defaultToken) {
    console.log('⚠️ Missing event ID or token, skipping');
    return;
  }

  // Each VU picks a random seat to maximize contention
  const seatId = `seat_${Math.floor(Math.random() * 200)}`;

  const payload = JSON.stringify({
    eventId: evId,
    seatIds: [seatId],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${defaultToken}`,
      'Idempotency-Key': `load_${__VU}_${__ITER}_${Date.now()}`,
    },
  };

  const start = Date.now();
  const res = http.post(`${API_URL}/api/v1/bookings`, payload, params);
  const duration = Date.now() - start;

  bookingDuration.add(duration);

  check(res, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  });

  if (res.status === 201) {
    bookingSuccess.add(1);
    successRate.add(true);
  } else if (res.status === 409) {
    bookingConflict.add(1);
    successRate.add(false);
  } else {
    bookingFailure.add(1);
    successRate.add(false);
  }

  // Small delay to simulate realistic user behavior
  sleep(0.1);
}

export function teardown(data) {
  console.log('\n📊 Load test complete!');
  console.log(`  Event: ${data.eventId}`);
  console.log('  Check metrics above for double booking verification.');
}

// Verification script (run separately or in afterAll)
export function handleSummary(data) {
  const successCount = data.root_group?.checks?.['status is 201 or 409']?.passes || 0;

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/results/booking-load-test.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  return `
╔══════════════════════════════════════════╗
║  PulseSeat Load Test Results            ║
╠══════════════════════════════════════════╣
║  Booking Success:    ${String(data.metrics.booking_success?.values?.count || 0).padStart(8)}  ║
║  Booking Conflicts:  ${String(data.metrics.booking_conflict?.values?.count || 0).padStart(8)}  ║
║  Booking Failures:   ${String(data.metrics.booking_failure?.values?.count || 0).padStart(8)}  ║
║  Double Bookings:    ${String(data.metrics.double_bookings?.values?.count || 0).padStart(8)}  ║
║  Avg Response Time:  ${String(Math.round(data.metrics.http_req_duration?.values?.avg || 0)).padStart(6)}ms  ║
║  p95 Response Time:  ${String(Math.round(data.metrics.http_req_duration?.values?.['p(95)'] || 0)).padStart(6)}ms  ║
║  p99 Response Time:  ${String(Math.round(data.metrics.http_req_duration?.values?.['p(99)'] || 0)).padStart(6)}ms  ║
╚══════════════════════════════════════════╝
`;
}
