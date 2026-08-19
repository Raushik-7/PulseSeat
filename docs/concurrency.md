# Concurrency Strategy

This document explains how PulseSeat guarantees zero double-bookings under concurrent load.

## The Problem

When N users attempt to book the same seat simultaneously, a naive implementation creates a race condition:

### Unsafe Implementation (DO NOT USE)

```sql
-- Transaction A                    -- Transaction B
BEGIN;                              BEGIN;
SELECT * FROM seats WHERE id = 1;   SELECT * FROM seats WHERE id = 1;
-- Returns: AVAILABLE               -- Returns: AVAILABLE
                                    -- Both see the same state!
UPDATE seats SET status = 'BOOKED'; UPDATE seats SET status = 'BOOKED';
COMMIT;                             COMMIT;
-- ✅ Success                       -- ✅ Success
-- RESULT: Double booking! 2 bookings for 1 seat
```

The root cause: both transactions read the same state without any locking.

## The Solution: Pessimistic Locking

### Safe Implementation (Production)

```sql
-- Transaction A                    -- Transaction B
BEGIN;                              BEGIN;
SELECT * FROM seats                 SELECT * FROM seats
WHERE id = 1                        WHERE id = 1
FOR UPDATE;  ← LOCKS ROW           FOR UPDATE; ← WAITS (blocked)
-- Lock acquired!                   -- Waiting for lock...
-- Returns: AVAILABLE               -- (blocked)
UPDATE seats SET status = 'BOOKED';
COMMIT;  ← RELEASES LOCK
                                   -- Lock acquired!
                                   -- Returns: BOOKED
                                   -- Check: status != AVAILABLE
                                   ROLLBACK;
-- ✅ 1 success, 1 conflict
-- RESULT: Zero double bookings!
```

`SELECT ... FOR UPDATE` acquires an exclusive row lock. Only one transaction can hold it at a time.

## Key Concepts

### 1. Transaction Isolation

PostgreSQL uses READ COMMITTED isolation by default. Each statement sees only data committed before the statement began. This is sufficient with row-level locking.

### 2. Row-Level Locking

```sql
SELECT * FROM seats WHERE id = 1 FOR UPDATE;
```

This:
- Acquires an exclusive lock on the row
- Blocks other transactions trying to lock the same row
- The lock is released when the transaction commits or rolls back

### 3. Deterministic Lock Ordering

When booking multiple seats, locks must be acquired in a consistent order to prevent deadlocks:

```sql
-- User requests: A10, A03, A07
-- Sort by ID: A03, A07, A10
-- Lock in this order:
SELECT * FROM seats
WHERE id IN ('A03_id', 'A07_id', 'A10_id')
ORDER BY id ASC  -- Deterministic order
FOR UPDATE;
```

Without deterministic ordering:
```
User 1: Lock A10, then A03
User 2: Lock A03, then A10
→ Potential deadlock!
```

With deterministic ordering:
```
User 1: Lock A03, then A10
User 2: Lock A03 (waits), then A10
→ No deadlock, User 2 waits until User 1 finishes
```

### 4. Atomic Multi-Seat Booking

If any requested seat is unavailable, the entire transaction rolls back:

```sql
BEGIN;
SELECT * FROM seats WHERE id IN (...) ORDER BY id FOR UPDATE;
-- Check: all seats are AVAILABLE
-- If ANY seat is not available → ROLLBACK
-- If ALL seats are available → continue
INSERT INTO bookings (...);
UPDATE seats SET status = 'BOOKED' WHERE id IN (...);
COMMIT;
```

No partial booking ever occurs.

### 5. Database Constraints as Safety Net

Even if application code has a bug, database constraints protect integrity:

```sql
-- Unique seat per event (prevents duplicate seats)
UNIQUE(event_id, seat_number)

-- Unique booking reference
UNIQUE(booking_reference)

-- Foreign keys
FOREIGN KEY (seat_id) REFERENCES seats(id)
```

### 6. Idempotency

Network retries can cause duplicate booking attempts. Idempotency keys prevent this:

```
Request 1: Idempotency-Key: abc123 → Creates booking → Stores result
Request 2: Idempotency-Key: abc123 → Returns cached result (no re-execution)
```

### 7. Transaction Timeouts

To prevent long-held locks:

```typescript
await prisma.$transaction(async (tx) => {
  // ... booking logic
}, {
  timeout: 10_000,  // Transaction timeout
  maxWait: 5_000,   // Max wait to start transaction
});
```

## Why Not Optimistic Locking?

Optimistic locking (version numbers + retries) works for low-contention scenarios. For high-contention events (500 seats, 5000 users), optimistic locking causes excessive retries and wasted work.

Pessimistic locking serializes access to contested rows, making the behavior predictable and efficient.

## Why Not Redis for Booking State?

Redis is fast but lacks:
- ACID transactions
- Row-level locking
- Persistent durability guarantees
- Referential integrity

PostgreSQL provides all of these. Redis handles caching, rate limiting, and ephemeral state.

## Testing Concurrency Correctness

The k6 load tests verify:
1. 500 concurrent users attempt to book from 200 available seats
2. Measure: successful bookings, conflicts, double bookings
3. **Expected: Double bookings = 0**
4. After the test, verify database state confirms no seat has more than one confirmed booking
