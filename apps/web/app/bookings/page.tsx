'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Ticket,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

const tabs = [
  { value: '', label: 'All' },
  { value: 'CONFIRMED', label: 'Upcoming' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const statusConfig: Record<string, { label: string; class: string }> = {
  CONFIRMED: { label: 'Confirmed', class: 'badge-success' },
  PENDING: { label: 'Pending', class: 'badge-warning' },
  CANCELLED: { label: 'Cancelled', class: 'badge-error' },
  EXPIRED: { label: 'Expired', class: 'badge-neutral' },
  FAILED: { label: 'Failed', class: 'badge-error' },
};

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
      toast({ title: 'Booking cancelled successfully', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || 'Cancellation failed. Please try again.', type: 'error' });
    },
  });

  const bookings = (data as any)?.data || [];

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Bookings</h1>
        <p className="text-dark-400 text-sm">View and manage your event tickets</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-dark-900/50 rounded-xl border border-dark-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filter === tab.value
                ? 'bg-dark-800 text-white shadow-sm'
                : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
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
            const status = statusConfig[booking.status] || { label: booking.status, class: 'badge-neutral' };

            return (
              <div
                key={booking.id}
                className="p-5 rounded-2xl border border-dark-800 bg-dark-900/30 hover:border-dark-600 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className={`badge ${status.class}`}>{status.label}</span>
                      <span className="text-xs text-dark-500 font-mono">{booking.bookingReference}</span>
                    </div>

                    <Link
                      href={`/booking/${booking.id}`}
                      className="font-semibold text-lg hover:text-brand-400 transition-colors block mb-1"
                    >
                      {booking.event?.name}
                    </Link>

                    <div className="flex flex-wrap gap-4 text-sm text-dark-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(booking.event?.eventDate)}
                      </div>
                      {booking.event?.startTime && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {booking.event.startTime}
                        </div>
                      )}
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

                  <div className="flex items-center gap-4 sm:shrink-0">
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(Number(booking.totalAmount))}</div>
                      <div className="text-xs text-dark-500 capitalize">{booking.paymentStatus}</div>
                    </div>

                    {booking.status === 'CONFIRMED' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to cancel this booking?')) {
                            cancelMutation.mutate(booking.id);
                          }
                        }}
                        disabled={cancelMutation.isPending}
                        className="px-3 py-2 rounded-xl text-xs font-medium text-dark-400 hover:text-red-400 hover:bg-red-500/10 border border-dark-700 hover:border-red-500/20 transition-all disabled:opacity-50"
                      >
                        {cancelMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Cancel'
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
        <div className="text-center py-20">
          <Ticket className="h-14 w-14 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium mb-2">
            {filter ? 'No bookings with this status' : 'No bookings yet'}
          </h3>
          <p className="text-dark-400 text-sm mb-6 max-w-md mx-auto">
            {filter
              ? 'Try selecting a different tab to see other bookings.'
              : 'Start exploring events and book your first tickets!'}
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-medium transition-colors"
          >
            Explore Events
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
