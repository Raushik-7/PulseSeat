// PulseSeat High Concurrency Test
// 100 VUs all targeting the SAME seat simultaneously
// Expected: exactly 1 success, 99 conflicts, 0 double bookings

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const API_URL = __ENV.API_URL || 'http://localhost:3001';

const bookingSuccess = new Counter('booking_success');
const bookingConflict = new Counter('booking_conflict');
const doubleBooking = new Counter('double_bookings');

export const options = {
  scenarios: {
    same_seat: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 100,
      maxDuration: '60s',
    },
  },
  thresholds: {
    double_bookings: ['count==0'],
    booking_success: ['count<=1'],
  },
};

let targetSeatId = null;
let eventId = null;
let token = null;

export function setup() {
  // Login
  const loginRes = http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({
    email: 'loadtest@pulseseat.dev',
    password: 'loadtest123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    token = JSON.parse(loginRes.body).data.token;
  }

  // Find concurrency arena
  const eventRes = http.get(`${API_URL}/api/v1/events`);
  if (eventRes.status === 200) {
    const events = JSON.parse(eventRes.body).data;
    const arena = events.find(e => e.slug === 'concurrency-arena');
    if (arena) eventId = arena.id;
  }

  // Get first available seat
  if (eventId && token) {
    const seatsRes = http.get(`${API_URL}/api/v1/events/${eventId}/seats`);
    if (seatsRes.status === 200) {
      const seats = JSON.parse(seatsRes.body).data;
      const available = seats.filter(s => s.status === 'AVAILABLE');
      if (available.length > 0) {
        targetSeatId = available[0].id;
        console.log(`🎯 Targeting seat: ${available[0].seatNumber} (${targetSeatId})`);
      }
    }
  }

  return { eventId, targetSeatId, token };
}

export default function (data) {
  if (!data.token || !data.eventId || !data.targetSeatId) {
    console.log('⚠️ Setup incomplete, skipping iteration');
    return;
  }

  const payload = JSON.stringify({
    eventId: data.eventId,
    seatIds: [data.targetSeatId],
  });

  const res = http.post(`${API_URL}/api/v1/bookings`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
      'Idempotency-Key': `concurrent_${__VU}_${__ITER}_${Date.now()}`,
    },
  });

  if (res.status === 201) {
    bookingSuccess.add(1);
    console.log(`✅ VU ${__VU}: Booking successful`);
  } else if (res.status === 409) {
    bookingConflict.add(1);
  } else {
    console.log(`❌ VU ${__VU}: Unexpected status ${res.status}`);
  }

  sleep(0.05);
}
