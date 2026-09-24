// ─── PulseSeat k6 shared configuration ──────────────────────────────────────
// All scripts import from here. Override via environment variables:
//   K6_BASE_URL      API base URL            (default http://localhost:3001)
//   K6_EVENT_ID      event id for seat/booking tests (default: auto-resolved)
//   K6_LOAD_PASSWORD password for seeded load-test users (default LoadTest123!)

import http from 'k6/http';

export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';
export const LOAD_USER_PASSWORD = __ENV.K6_LOAD_PASSWORD || 'LoadTest123!';
export const LOAD_USER_COUNT = 600; // seeded users load0..load599@loadtest.local

export const SEARCH_TERMS = [
  'IPL', 'music', 'comedy', 'summit', 'festival',
  'Mumbai', 'dance', 'film', 'blockchain', 'marathon',
];
export const CATEGORIES = ['Music', 'Technology', 'Comedy', 'Film', 'Sports', 'Dance'];
export const CITIES = ['Mumbai', 'New Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune'];

// Deterministic pseudo-random from VU id — keeps runs reproducible
export function seededVU(vu, mod) {
  return (vu * 2654435761) % mod;
}

export function loadUserEmail(vu) {
  return `load${vu % LOAD_USER_COUNT}@loadtest.local`;
}

export function login(email) {
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({ email, password: LOAD_USER_PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${res.body}`);
  }
  return res.json().data.token;
}

// Resolve the event used for seat/booking tests: the PUBLISHED event with the
// most AVAILABLE seats. Resolved once in setup() and shared with all VUs.
export function resolveTestEvent() {
  const res = http.get(`${BASE_URL}/api/v1/events?limit=50&page=1`);
  if (res.status !== 200) throw new Error(`events list failed: ${res.status}`);
  const events = res.json().data;
  if (!events.length) throw new Error('no events found — is the database seeded?');
  events.sort((a, b) => b.availableSeats - a.availableSeats);
  const event = events[0];
  return { eventId: event.id, eventName: event.name, availableSeats: event.availableSeats };
}

export function fetchSeatIds(eventId, max) {
  const res = http.get(`${BASE_URL}/api/v1/events/${eventId}/seats`);
  if (res.status !== 200) throw new Error(`seats fetch failed: ${res.status}`);
  const seats = res.json().data.filter((s) => s.status === 'AVAILABLE');
  return seats.slice(0, max).map((s) => s.id);
}

export const jsonHeaders = { headers: { 'Content-Type': 'application/json' } };
