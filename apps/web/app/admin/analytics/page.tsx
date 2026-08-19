'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const COLORS = ['#5c7cfa', '#22b8cf', '#51cf66', '#fcc419', '#ff6b6b', '#cc5de8'];

export default function AdminAnalyticsPage() {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => apiClient.getAdminAnalytics(token!),
    enabled: !!token && isAdmin,
  });

  const analytics = (data as any)?.data;

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-dark-400">Booking trends and performance metrics.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton h-80 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bookings over time */}
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold mb-4">Bookings Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.bookingsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1d23" />
                <XAxis dataKey="date" stroke="#495057" fontSize={12} />
                <YAxis stroke="#495057" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #343a40', borderRadius: '12px' }}
                  labelStyle={{ color: '#f8f9fa' }}
                />
                <Line type="monotone" dataKey="count" stroke="#5c7cfa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bookings by event */}
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold mb-4">Popular Events</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.bookingsByEvent} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1d23" />
                <XAxis type="number" stroke="#495057" fontSize={12} />
                <YAxis dataKey="eventName" type="category" stroke="#495057" fontSize={10} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #343a40', borderRadius: '12px' }}
                />
                <Bar dataKey="count" fill="#5c7cfa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bookings by status */}
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold mb-4">Bookings by Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.bookingsByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {analytics.bookingsByStatus.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #343a40', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue */}
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold mb-4">Revenue Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.bookingsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1d23" />
                <XAxis dataKey="date" stroke="#495057" fontSize={12} />
                <YAxis stroke="#495057" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #343a40', borderRadius: '12px' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#51cf66" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-dark-400">No analytics data available yet.</div>
      )}
    </div>
  );
}
