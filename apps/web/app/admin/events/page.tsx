'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Plus, RotateCcw, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

export default function AdminEventsPage() {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => apiClient.getEvents({ limit: '50' }),
    enabled: !!token,
  });

  const resetMutation = useMutation({
    mutationFn: (eventId: string) => apiClient.resetSeats(eventId, token!),
    onSuccess: () => {
      toast({ title: 'Seats reset successfully', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
    onError: (err: any) => {
      toast({ title: err.message, type: 'error' });
    },
  });

  const events = (data as any)?.data || [];

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Events</h1>
          <p className="text-dark-400">Manage events and their seat inventory.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dark-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Event</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">City</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-dark-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event.id} className="border-b border-dark-800/50 hover:bg-dark-900/30">
                    <td className="px-4 py-3 font-medium">{event.name}</td>
                    <td className="px-4 py-3 text-dark-400">{event.category}</td>
                    <td className="px-4 py-3 text-dark-400">{event.city}</td>
                    <td className="px-4 py-3 text-dark-400">{formatDate(event.eventDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        event.status === 'PUBLISHED' ? 'badge-success' :
                        event.status === 'DRAFT' ? 'badge-warning' :
                        event.status === 'CANCELLED' ? 'badge-error' : 'badge-neutral'
                      }`}>{event.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => resetMutation.mutate(event.id)}
                        disabled={resetMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dark-800 text-xs text-dark-300 hover:text-white transition-colors"
                        title="Reset all seats to AVAILABLE"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset Seats
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
