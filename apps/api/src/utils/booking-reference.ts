import { customAlphabet } from 'nanoid';

// Generate booking references like PS-A3K9M2
const generate = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export function createBookingReference(): string {
  return `PS-${generate()}`;
}

// Generate idempotency keys
export function createIdempotencyKey(): string {
  return customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 32)();
}
