'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  Calendar,
  MapPin,
  Clock,
  Ticket,
  ArrowRight,
  Copy,
  Share2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

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
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="skeleton h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Ticket className="h-14 w-14 text-dark-600 mx-auto mb-4" />
        <h2 className="text-xl font-medium mb-2">Booking not found</h2>
        <Link href="/bookings" className="text-brand-400 hover:underline text-sm">View My Bookings</Link>
      </div>
    );
  }

  const seats = booking.bookingItems?.map((item: any) => item.seat) || [];

  const copyRef = () => {
    navigator.clipboard.writeText(booking.bookingReference);
    toast({ title: 'Reference copied!', type: 'success' });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-dark-400">Your tickets are ready. Show this at the venue entrance.</p>
      </div>

      {/* Ticket card */}
      <div className="rounded-2xl border border-dark-800 overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-brand-500 to-green-400" />

        <div className="p-6 sm:p-8">
          {/* Booking reference */}
          <div className="flex items-center justify-between mb-6 p-3 rounded-xl bg-dark-800/50">
            <div>
              <div className="text-[10px] text-dark-500 uppercase tracking-wider">Booking ID</div>
              <div className="text-lg font-mono font-bold text-brand-400">{booking.bookingReference}</div>
            </div>
            <button
              onClick={copyRef}
              className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
              title="Copy reference"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          {/* Event */}
          <div className="mb-6">
            <div className="text-xs text-dark-500 mb-1">Event</div>
            <div className="font-semibold text-lg">{booking.event?.name}</div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-dark-500 mb-1">Date</div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-3.5 w-3.5 text-dark-400" />
                {formatDate(booking.event?.eventDate)}
              </div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Time</div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 text-dark-400" />
                {booking.event?.startTime}
              </div>
            </div>
            <div>
              <div className="text-xs text-dark-500 mb-1">Venue</div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-dark-400" />
                {booking.event?.venue}
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

          {/* Total */}
          <div className="border-t border-dark-700 pt-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-dark-500">Amount Paid</div>
              <div className="text-xs text-dark-500 capitalize">{booking.paymentStatus}</div>
            </div>
            <div className="text-2xl font-bold text-brand-400">
              {formatCurrency(Number(booking.totalAmount))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-dark-800 p-6 grid grid-cols-2 gap-3">
          <Link
            href="/bookings"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-medium text-sm transition-colors"
          >
            My Bookings
          </Link>
          <Link
            href="/events"
            className="flex items-center justify-center gap-2 px-4 py-3 border border-dark-700 hover:border-dark-500 text-dark-300 hover:text-white rounded-xl font-medium text-sm transition-colors"
          >
            Browse More
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
