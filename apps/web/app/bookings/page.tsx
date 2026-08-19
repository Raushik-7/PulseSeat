'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { BookOpen, Calendar, MapPin, Ticket, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

export default function BookingsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', filter],
    queryFn: () => apiClient.getBookings(token!, filter || undefined),
    enabled: !!token,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.cancelBooking(id, token!),
    onSuccess: () => {
      toast({ title: 'Booking cancelled', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || 'Cancellation failed', type: 'error' });
    },
  });

  const bookings = (data as any)?.data || [];

  const statusColors: Record<string, string> = {
    CONFIRMED: 'badge-success',
    PENDING: 'badge-warning',
    CANCELLED: 'badge-error',
    EXPIRED: 'badge-neutral',
    FAILED: 'badge-error',
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">My Bookings</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { value: '', label: 'All' },
          { value: 'CONFIRMED', label: 'Upcoming' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              filter === tab.value
                ? 'bg-brand-500 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Bookings list */}
      {!isLoading && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking: any) => {
            const seats = booking.bookingItems?.map((item: any) => item.seat?.seatNumber).filter(Boolean) || [];
            return (
              <div
                key={booking.id}
                className="p-5 rounded-2xl border border-dark-800 bg-dark-900/30 hover:border-dark-600 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/booking/${booking.id}`}
                        className="font-mono text-sm font-medium text-brand-400 hover:underline"
                      >
                        {booking.bookingReference}
                      </Link>
                      <span className={`badge ${statusColors[booking.status] || 'badge-neutral'}`}>
                        {booking.status}
                      </span>
                    </div>

                    <h3 className="font-medium mb-1">{booking.event?.name}</h3>

                    <div className="flex flex-wrap gap-4 text-sm text-dark-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(booking.event?.eventDate)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {booking.event?.venue}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Ticket className="h-3.5 w-3.5" />
                        {seats.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(Number(booking.totalAmount))}</div>
                      <div className="text-xs text-dark-500">{booking.paymentStatus}</div>
                    </div>
                    {booking.status === 'CONFIRMED' && (
                      <button
                        onClick={() => cancelMutation.mutate(booking.id)}
                        disabled={cancelMutation.isPending}
                        className="p-2 rounded-xl text-dark-400 hover:text-red-400 hover:bg-dark-800 transition-colors"
                        title="Cancel booking"
                      >
                        {cancelMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && bookings.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No bookings yet</h3>
          <p className="text-dark-400 text-sm mb-6">You haven&apos;t booked any tickets yet.</p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-medium transition-colors"
          >
            Explore Events
          </Link>
        </div>
      )}
    </div>
  );
}
