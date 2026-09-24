// Payment provider abstraction
// Supports Stripe (production) and Mock (development/testing)
// The provider is selected based on the PAYMENT_PROVIDER env var

import { config } from '../../config/index';
import { logger } from '../../utils/logger';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  clientSecret?: string; // Stripe client secret for frontend confirmation
}

export interface PaymentProvider {
  createPayment(bookingId: string, amount: number, currency: string): Promise<PaymentIntent>;
  verifyPayment(paymentId: string): Promise<PaymentIntent>;
  refundPayment(paymentId: string): Promise<PaymentIntent>;
}

// ─── Mock Provider (Development / Testing) ──────────────────────────────────
//
// Always succeeds. For local dev when Stripe keys aren't available.
// Clearly marked: DO NOT USE IN PRODUCTION.

class MockPaymentProvider implements PaymentProvider {
  async createPayment(_bookingId: string, amount: number, currency: string): Promise<PaymentIntent> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      id: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount,
      currency,
      status: 'succeeded',
    };
  }

  async verifyPayment(paymentId: string): Promise<PaymentIntent> {
    return {
      id: paymentId,
      amount: 0,
      currency: 'INR',
      status: 'succeeded',
    };
  }

  async refundPayment(paymentId: string): Promise<PaymentIntent> {
    return {
      id: paymentId,
      amount: 0,
      currency: 'INR',
      status: 'succeeded',
    };
  }
}

// ─── Provider Factory ───────────────────────────────────────────────────────
//
// Lazily initialized. Selects Stripe or Mock based on config.

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  if (config.payment.provider === 'stripe' && config.payment.secret) {
    logger.info('Using Stripe payment provider');
    // Dynamic import to avoid loading Stripe SDK when not needed
    const { StripePaymentProvider } = require('./stripe.provider');
    provider = new StripePaymentProvider();
  } else {
    logger.info('Using Mock payment provider (development mode)');
    provider = new MockPaymentProvider();
  }

  return provider!;
}
