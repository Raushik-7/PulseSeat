# Load Testing

## Overview

PulseSeat uses k6 for load testing. Tests verify that concurrent booking requests never result in double-bookings.

## Setup

```bash
# Install k6
brew install k6  # macOS
# or: sudo apt-get install k6  # Ubuntu
# or: docker pull grafana/k6
```

## Tests

### 1. Booking Load Test

Simulates 500 concurrent users with 500 available seats.

```bash
k6 run load-tests/booking-load-test.js
```

**Scenarios:**
- Ramp up to 500 VUs over 10 seconds
- Sustain 500 VUs for 30 seconds
- Ramp down over 10 seconds

**Expected results:**
- Booking success ≤ 500
- Booking conflicts ≥ 0
- **Double bookings = 0**
- p95 latency < 500ms

### 2. High Concurrency Test

100 VUs all targeting the **same seat** simultaneously.

```bash
k6 run load-tests/high-concurrency-test.js
```

**Expected results:**
- **Exactly 1 success**
- **99 conflicts**
- **0 double bookings**

### 3. Double-Booking Verification

Post-test database verification.

```bash
k6 run load-tests/verify-no-double-bookings.js
```

**Expected results:**
- No seat appears in more than one confirmed booking

## Running Against Docker

```bash
docker-compose --profile loadtest run k6 run /scripts/booking-load-test.js
```

## Results

Results are saved to `load-tests/results/` as JSON for analysis.

## Metrics

| Metric | Description |
|--------|-------------|
| `booking_success` | Successful bookings |
| `booking_conflict` | Conflict responses (409) |
| `booking_failure` | Other failures |
| `double_bookings` | Should always be 0 |
| `http_req_duration` | Response time (p95, p99) |
| `booking_success_rate` | Success ratio |

## Verifying Correctness

After running load tests, verify database state:

```sql
-- Check for double-booked seats
SELECT seat_id, COUNT(*) as booking_count
FROM booking_items bi
JOIN bookings b ON bi.booking_id = b.id
WHERE b.status = 'CONFIRMED'
GROUP BY bi.seat_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```
