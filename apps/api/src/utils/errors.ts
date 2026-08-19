export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, 'NOT_FOUND', id ? `${resource} with id ${id} not found` : `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class SeatConflictError extends ConflictError {
  constructor(seatNumbers: string[]) {
    super(`Seat(s) ${seatNumbers.join(', ')} are no longer available.`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}

export class PaymentError extends AppError {
  constructor(message: string) {
    super(402, 'PAYMENT_FAILED', message);
  }
}

export class IdempotencyError extends ConflictError {
  constructor(message = 'Duplicate request detected') {
    super(message);
  }
}
