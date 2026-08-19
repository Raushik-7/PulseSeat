// Payment provider abstraction
// In development, uses a mock provider that always succeeds
// In production, swap with Stripe/Razorpay provider

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface PaymentProvider {
  createPayment(bookingId: string, amount: number, currency: string): Promise<PaymentIntent>;
  verifyPayment(paymentId: string): Promise<PaymentIntent>;
  refundPayment(paymentId: string): Promise<PaymentIntent>;
}

class MockPaymentProvider implements PaymentProvider {
  async createPayment(_bookingId: string, amount: number, currency: string): Promise<PaymentIntent> {
    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

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

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = new MockPaymentProvider();
  }
  return provider;
}
