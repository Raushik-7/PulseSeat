'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  BookOpen,
  Users,
  DollarSign,
  Ticket,
  Activity,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';

export default function AdminDashboard() {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiClient.getAdminDashboard(token!),
    enabled: !!token && isAdmin,
  });

  const dashboard = (data as any)?.data;

  if (!user || !isAdmin) return null;

  const metrics = dashboard
    ? [
        { label: 'Total Events', value: dashboard.totalEvents, icon: Calendar, color: 'text-brand-400' },
        { label: 'Total Bookings', value: dashboard.totalBookings, icon: BookOpen, color: 'text-blue-400' },
        { label: 'Total Users', value: dashboard.totalUsers, icon: Users, color: 'text-green-400' },
        { label: 'Revenue', value: formatCurrency(Number(dashboard.totalRevenue)), icon: DollarSign, color: 'text-yellow-400' },
        { label: 'Tickets Sold', value: dashboard.seatsBooked, icon: Ticket, color: 'text-purple-400' },
        { label: 'Success Rate', value: `${dashboard.successRate}%`, icon: Activity, color: 'text-green-400' },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-dark-400">Overview of PulseSeat booking system metrics.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Metrics cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="p-5 rounded-2xl border border-dark-800 bg-dark-900/30 hover:border-dark-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-dark-400">{m.label}</span>
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                </div>
                <div className="text-2xl font-bold">{m.value}</div>
              </div>
            ))}
          </div>

          {/* Live metrics */}
          {dashboard.metrics && (
            <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand-400" />
                Live Concurrency Metrics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-dark-400 mb-1">Booking Attempts</div>
                  <div className="text-xl font-bold text-brand-400">
                    {dashboard.metrics.bookingAttempts}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-dark-400 mb-1">Successful Bookings</div>
                  <div className="text-xl font-bold text-green-400">
                    {dashboard.metrics.bookingSuccess}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-dark-400 mb-1">Conflicts (Double-Book Prevention)</div>
                  <div className="text-xl font-bold text-yellow-400">
                    {dashboard.metrics.bookingConflicts}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
