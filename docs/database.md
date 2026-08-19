# Database Design

## ER Diagram

```
users ──────────┐
  │              │
  ├─ bookings ───┤
  │    │         │
  │    ├─ booking_items ── seats ── events
  │    │
  │    └─ payments
  │
  ├─ audit_logs
  └─ idempotency_keys
```

## Tables

### users
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| email | TEXT | UNIQUE |
| name | TEXT | NOT NULL |
| password_hash | TEXT | NOT NULL |
| role | ENUM(USER, ADMIN) | DEFAULT USER |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | AUTO-UPDATE |

### events
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| name | TEXT | NOT NULL |
| slug | TEXT | UNIQUE |
| description | TEXT | |
| category | TEXT | INDEXED |
| venue | TEXT | |
| city | TEXT | INDEXED |
| event_date | TIMESTAMP | INDEXED |
| start_time | TEXT | |
| end_time | TEXT | |
| status | ENUM(DRAFT,PUBLISHED,SOLD_OUT,CANCELLED,COMPLETED) | INDEXED |
| created_at | TIMESTAMP | |

### seats
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| event_id | TEXT | FK→events, INDEXED |
| seat_number | TEXT | |
| row | TEXT | INDEXED |
| section | TEXT | |
| price | DECIMAL(10,2) | |
| status | ENUM(AVAILABLE,HELD,BOOKED,DISABLED) | |
| booked_by | TEXT | FK→users |

**Critical constraint**: `UNIQUE(event_id, seat_number)` — prevents duplicate seats

**Critical index**: `INDEX(event_id, status)` — fast availability queries

### bookings
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| user_id | TEXT | FK→users, INDEXED |
| event_id | TEXT | FK→events, INDEXED |
| booking_reference | TEXT | UNIQUE |
| status | ENUM(PENDING,CONFIRMED,CANCELLED,EXPIRED,FAILED) | INDEXED |
| total_amount | DECIMAL(10,2) | |
| payment_status | ENUM(PENDING,PAID,FAILED,REFUNDED) | |
| hold_expires_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### booking_items
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| booking_id | TEXT | FK→bookings, INDEXED |
| seat_id | TEXT | FK→seats, INDEXED |
| price | DECIMAL(10,2) | |

### payments
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| booking_id | TEXT | FK→bookings, INDEXED |
| provider | ENUM(STRIPE,RAZORPAY,MOCK) | |
| provider_payment_id | TEXT | UNIQUE |
| amount | DECIMAL(10,2) | |
| currency | TEXT | DEFAULT INR |
| status | ENUM(PENDING,PAID,FAILED,REFUNDED) | |

### idempotency_keys
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| key | TEXT | UNIQUE, INDEXED |
| request_hash | TEXT | |
| response_status | INT | |
| response_body | JSON | |
| expires_at | TIMESTAMP | INDEXED |

### audit_logs
| Column | Type | Constraints |
|--------|------|------------|
| id | TEXT (cuid) | PK |
| user_id | TEXT | FK→users, INDEXED |
| action | TEXT | |
| entity_type | TEXT | INDEXED (with entity_id) |
| entity_id | TEXT | |
| metadata | JSON | |
| created_at | TIMESTAMP | INDEXED |

## Indexes

Strategic indexes based on query patterns:

```sql
-- Event listing/filtering
INDEX events(status)
INDEX events(event_date)
INDEX events(city)
INDEX events(category)

-- Seat queries (critical for booking performance)
INDEX seats(event_id)
INDEX seats(event_id, status)  -- Composite for availability queries
INDEX seats(event_id, row)     -- For seat map display

-- Booking queries
INDEX bookings(user_id)
INDEX bookings(event_id)
INDEX bookings(status)
INDEX bookings(booking_reference)  -- UNIQUE

-- Audit trail
INDEX audit_logs(user_id)
INDEX audit_logs(entity_type, entity_id)
INDEX audit_logs(created_at)
```

## Transaction Strategy

All booking operations use PostgreSQL transactions:

```sql
BEGIN;

-- Acquire locks in deterministic order
SELECT * FROM seats
WHERE id = ANY($seat_ids)
ORDER BY id ASC
FOR UPDATE;

-- Verify availability
-- ... check logic ...

-- Create booking and update seats
INSERT INTO bookings ...
INSERT INTO booking_items ...
UPDATE seats SET status = 'BOOKED' WHERE id = ANY($seat_ids);

COMMIT;
```

Transaction settings:
- Isolation: READ COMMITTED (default)
- Timeout: 10 seconds
- Max wait: 5 seconds
