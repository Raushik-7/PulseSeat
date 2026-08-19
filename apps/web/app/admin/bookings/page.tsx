'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function AdminBookingsPage() {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => apiClient.getAdminBookings(token!),
    enabled: !!token && isAdmin,
  });

  const bookings = (data as any)?.data || [];

  const statusColors: Record<string, string> = {
    CONFIRMED: 'badge-success',
    PENDING: 'badge-warning',
    CANCELLED: 'badge-error',
    EXPIRED: 'badge-neutral',
    FAILED: 'badge-error',
  };

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">All Bookings</h1>
        <p className="text-dark-400">View and manage all bookings in the system.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : bookings.length > 0 ? (
        <div className="rounded-2xl border border-dark-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Reference</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">User</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Event</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Seats</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b: any) => (
                  <tr key={b.id} className="border-b border-dark-800/50 hover:bg-dark-900/30">
                    <td className="px-4 py-3 font-mono text-brand-400">{b.bookingReference}</td>
                    <td className="px-4 py-3">{b.user?.name || '—'}</td>
                    <td className="px-4 py-3">{b.event?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {b.bookingItems?.map((i: any) => i.seat?.seatNumber).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(Number(b.totalAmount))}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusColors[b.status] || 'badge-neutral'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark-400">{formatDate(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No bookings yet</h3>
        </div>
      )}
    </div>
  );
}
