'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Calendar, MapPin, Clock, Ticket, Download, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function BookingSuccessPage() {
  const params = useParams();
  const { token } = useAuth();
  const bookingId = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiClient.getBooking(bookingId, token!),
    enabled: !!token,
  });

  const booking = (data as any)?.data;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="skeleton h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2 className="text-xl font-medium mb-2">Booking not found</h2>
        <Link href="/bookings" className="text-brand-400 hover:underline">View My Bookings</Link>
      </div>
    );
  }

  const seats = booking.bookingItems?.map((item: any) => item.seat) || [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Success header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Booking Confirmed</h1>
        <p className="text-dark-400">Your tickets have been booked successfully.</p>
      </div>

      {/* Ticket card */}
      <div className="rounded-2xl border border-dark-800 overflow-hidden">
        {/* Top gradient */}
        <div className="h-2 bg-gradient-to-r from-brand-500 to-brand-400" />

        <div className="p-6 sm:p-8">
          {/* Booking reference */}
          <div className="text-center mb-8">
            <div className="text-xs text-dark-500 uppercase tracking-wider mb-1">Booking Reference</div>
            <div className="text-2xl font-mono font-bold text-brand-400">
              {booking.bookingReference}
            </div>
          </div>

          {/* Event info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-xs text-dark-500 mb-1">Event</div>
              <div className="font-medium">{booking.event?.name}</div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Date</div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5 text-dark-400" />
                {formatDate(booking.event?.eventDate)} · {booking.event?.startTime}
              </div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Venue</div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-dark-400" />
                {booking.event?.venue}, {booking.event?.city}
              </div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Seats</div>
              <div className="flex items-center gap-2 text-sm">
                <Ticket className="h-3.5 w-3.5 text-dark-400" />
                {seats.map((s: any) => s.seatNumber).join(', ')}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="border-t border-dark-700 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-dark-500">Total Amount</div>
                <div className="text-xs text-dark-500">Payment: {booking.paymentStatus}</div>
              </div>
              <div className="text-2xl font-bold text-brand-400">
                {formatCurrency(Number(booking.totalAmount))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-dark-800 p-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/bookings"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-medium transition-colors"
          >
            View My Bookings
          </Link>
          <Link
            href="/events"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-dark-700 hover:border-dark-500 text-dark-300 hover:text-white rounded-xl font-medium transition-colors"
          >
            Browse More Events
          </Link>
        </div>
      </div>
    </div>
  );
}
