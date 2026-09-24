'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  Loader2,
  Lock,
  CheckCircle,
  ArrowLeft,
  Calendar,
  MapPin,
  Ticket,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'summary' | 'payment' | 'processing' | 'success'>('summary');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');

  // Get booking details from URL params — amount already includes the convenience fee
  const eventId = searchParams.get('eventId');
  const seatIds = searchParams.get('seatIds')?.split(',') || [];
  const amount = searchParams.get('amount');
  const subtotal = amount ? Math.round(Number(amount) / 1.02) : 0;
  const fee = subtotal ? Number(amount) - subtotal : 0;

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (amount) {
      setTotalAmount(Number(amount));
    }
  }, [user, amount, router]);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/[^0-9]/g, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handlePayment = async () => {
    if (!token || !eventId || seatIds.length === 0) return;

    setStep('processing');
    setLoading(true);

    try {
      // 1. Create the booking
      const idempotencyKey = `checkout_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const bookingResult: any = await apiClient.createBooking(
        { eventId, seatIds },
        token,
        idempotencyKey,
      );

      const newBookingId = bookingResult.data.bookingId;
      setBookingId(newBookingId);

      // 2. Create payment intent
      const paymentResult: any = await apiClient.createPaymentIntent(newBookingId, token);

      // 3. Confirm payment (in mock mode, this succeeds immediately)
      await apiClient.confirmPayment(newBookingId, paymentResult.data.paymentIntentId, token);

      // 4. Get booking details
      const bookingDetails: any = await apiClient.getBooking(newBookingId, token);
      setBookingRef(bookingDetails.data.bookingReference);

      setStep('success');
      toast({ title: 'Payment successful!', type: 'success' });
    } catch (err: any) {
      const message = err?.message || 'Payment failed. Please try again.';
      toast({ title: message, type: 'error' });
      setStep('summary');
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (step === 'success') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-6">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
        <p className="text-dark-400 mb-2">Your booking is confirmed.</p>
        {bookingRef && (
          <p className="text-sm text-dark-500 mb-8">
            Booking Reference: <span className="font-mono font-bold text-brand-400">{bookingRef}</span>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          {bookingId && (
            <Link
              href={`/booking/${bookingId}`}
              className="px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-colors"
            >
              View Ticket
            </Link>
          )}
          <Link
            href="/bookings"
            className="px-6 py-3 border border-dark-700 hover:border-dark-500 text-dark-300 hover:text-white rounded-xl font-medium transition-colors"
          >
            My Bookings
          </Link>
        </div>
      </div>
    );
  }

  // Processing state
  if (step === 'processing') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Loader2 className="h-12 w-12 text-brand-400 mx-auto mb-4 animate-spin" />
        <h2 className="text-xl font-bold mb-2">Processing your payment</h2>
        <p className="text-dark-400 text-sm">Please don&apos;t close this page...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        href={eventId ? `/events/${eventId}` : '/events'}
        className="inline-flex items-center gap-2 text-sm text-dark-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Payment form */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-dark-800 bg-dark-900/50 p-6">
            <div className="flex items-center gap-2 mb-6">
              <CreditCard className="h-5 w-5 text-brand-400" />
              <h2 className="text-lg font-semibold">Payment Details</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Cardholder Name</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Name on card"
                  className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" />
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Expiry</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">CVC</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Security badges */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-dark-500">
                  <Lock className="h-3 w-3" />
                  <span>256-bit SSL</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-dark-500">
                  <Shield className="h-3 w-3" />
                  <span>PCI Compliant</span>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={loading || !cardNumber || !cardExpiry || !cardCvc || !cardName}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Pay {formatCurrency(totalAmount)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-dark-800 bg-dark-900/50 p-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 text-sm">
                <Ticket className="h-4 w-4 text-dark-500 shrink-0" />
                <span className="text-dark-300">{seatIds.length} ticket{seatIds.length > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="border-t border-dark-700 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Tickets subtotal</span>
                <span className="text-dark-300">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Convenience fee (2%)</span>
                <span className="text-dark-300">{formatCurrency(fee)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-dark-700">
                <span>Total</span>
                <span className="text-brand-400">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            <p className="text-xs text-dark-500 mt-4 flex items-start gap-1.5">
              <Lock className="h-3 w-3 shrink-0 mt-0.5" />
              Your payment is encrypted and secure. We never store your card details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="skeleton h-96 w-full rounded-2xl" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
