# API Reference

Base URL: `http://localhost:3001`

All responses follow the format:
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... }  // for list endpoints
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "requestId": "req_..."
}
```

## Authentication

All protected endpoints require:
```
Authorization: Bearer <token>
```

## Endpoints

### Auth

**POST /api/v1/auth/signup**
```json
// Request
{ "name": "John", "email": "john@example.com", "password": "secret123" }
// Response 201
{ "success": true, "data": { "user": { ... }, "token": "eyJ..." } }
```

**POST /api/v1/auth/login**
```json
// Request
{ "email": "john@example.com", "password": "secret123" }
// Response 200
{ "success": true, "data": { "user": { ... }, "token": "eyJ..." } }
```

**GET /api/v1/auth/me** (Auth required)
```json
// Response 200
{ "success": true, "data": { "id": "...", "name": "John", "email": "...", "role": "USER" } }
```

### Events

**GET /api/v1/events**
Query params: `page`, `limit`, `search`, `category`, `city`, `dateFrom`, `dateTo`
```json
// Response 200
{
  "success": true,
  "data": [{ "id": "...", "name": "...", "totalSeats": 200, "availableSeats": 156, ... }],
  "pagination": { "page": 1, "limit": 12, "total": 8, "totalPages": 1 }
}
```

**GET /api/v1/events/:id**
```json
// Response 200
{ "success": true, "data": { "id": "...", "name": "...", "totalSeats": 200, "bookedSeats": 44, "availableSeats": 156 } }
```

### Seats

**GET /api/v1/events/:eventId/seats**
```json
// Response 200
{ "success": true, "data": [{ "id": "...", "seatNumber": "A01", "row": "A", "section": "VIP", "price": 5000, "status": "AVAILABLE" }] }
```

**GET /api/v1/events/:eventId/availability**
```json
// Response 200
{ "success": true, "data": { "totalSeats": 200, "availableSeats": 156, "bookedSeats": 44, "sections": { "VIP": { "AVAILABLE": 30, "BOOKED": 10 } } } }
```

### Bookings

**POST /api/v1/bookings** (Auth required)
Headers: `Idempotency-Key: <optional-key>`
```json
// Request
{ "eventId": "...", "seatIds": ["seat_id_1", "seat_id_2"] }
// Response 201
{ "success": true, "data": { "bookingId": "...", "bookingReference": "PS-A3K9M2", "totalAmount": 10000, "seatCount": 2 } }
// Response 409 (Conflict)
{ "success": false, "error": { "code": "SEAT_CONFLICT", "message": "Seat(s) A01, A02 are no longer available." } }
```

**GET /api/v1/bookings** (Auth required)
Query params: `status` (CONFIRMED, CANCELLED, etc.)

**GET /api/v1/bookings/:id** (Auth required)

**POST /api/v1/bookings/:id/cancel** (Auth required)

### Admin

**GET /api/v1/admin/dashboard** (Admin required)
**GET /api/v1/admin/bookings** (Admin required)
**GET /api/v1/admin/users** (Admin required)
**GET /api/v1/admin/analytics** (Admin required)
**GET /api/v1/admin/audit-logs** (Admin required)
**POST /api/v1/admin/events** (Admin required)
**POST /api/v1/admin/events/:eventId/reset-seats** (Admin required)

### Health

**GET /health** — Liveness
**GET /health/ready** — Readiness (checks PostgreSQL + Redis)
**GET /metrics** — Prometheus metrics
