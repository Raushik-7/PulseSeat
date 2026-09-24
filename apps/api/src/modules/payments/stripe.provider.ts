import Stripe from 'stripe';
import { PaymentProvider, PaymentIntent } from './payments.service';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';

// ─── Stripe Payment Provider ─────────────────────────────────────────────────
//
// Real Stripe integration replacing the mock provider.
// Uses Stripe Payment Intents for secure, PCI-compliant payment processing.
//
// Flow:
//   1. createPayment → Creates a PaymentIntent with Stripe
//   2. verifyPayment → Confirms the PaymentIntent status
//   3. refundPayment → Creates a refund for a completed payment

const stripe = new Stripe(config.payment.secret, {
  apiVersion: '2025-05-27.basil' as Stripe.LatestApiVersion,
});

export class StripePaymentProvider implements PaymentProvider {
  /**
   * Create a Stripe PaymentIntent for a booking.
   * Returns a client_secret the frontend uses to confirm payment.
   */
  async createPayment(bookingId: string, amount: number, currency: string): Promise<PaymentIntent> {
    logger.info({ bookingId, amount, currency }, 'Creating Stripe PaymentIntent');

    try {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects cents/paise
        currency: currency.toLowerCase(),
        metadata: {
          bookingId,
          platform: 'pulseseat',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info({ bookingId, paymentIntentId: intent.id }, 'Stripe PaymentIntent created');

      return {
        id: intent.id,
        amount: amount,
        currency: currency.toUpperCase(),
        status: intent.status === 'succeeded' ? 'succeeded' : 'pending',
      };
    } catch (err) {
      logger.error({ err, bookingId }, 'Failed to create Stripe PaymentIntent');
      throw err;
    }
  }

  /**
   * Verify the current status of a PaymentIntent.
   */
  async verifyPayment(paymentId: string): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentId);

      return {
        id: intent.id,
        amount: intent.amount / 100, // Convert from cents/paise
        currency: intent.currency.toUpperCase(),
        status: intent.status === 'succeeded' ? 'succeeded' : 'pending',
      };
    } catch (err) {
      logger.error({ err, paymentId }, 'Failed to verify Stripe PaymentIntent');
      throw err;
    }
  }

  /**
   * Create a full refund for a completed payment.
   */
  async refundPayment(paymentId: string): Promise<PaymentIntent> {
    logger.info({ paymentId }, 'Processing Stripe refund');

    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentId,
      });

      logger.info({ paymentId, refundId: refund.id }, 'Stripe refund created');

      return {
        id: refund.id,
        amount: (refund.amount || 0) / 100,
        currency: refund.currency?.toUpperCase() || 'INR',
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
      };
    } catch (err) {
      logger.error({ err, paymentId }, 'Failed to refund Stripe payment');
      throw err;
    }
  }

  /**
   * Handle Stripe webhook events for async payment confirmations.
   */
  async handleWebhook(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    const webhookSecret = config.payment.webhookSecret;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
