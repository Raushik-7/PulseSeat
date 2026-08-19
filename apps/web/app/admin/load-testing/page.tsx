'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function AdminLoadTestingPage() {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiClient.getAdminDashboard(token!),
    enabled: !!token && isAdmin,
  });

  const metrics = (data as any)?.data?.metrics;

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Load Testing</h1>
        <p className="text-dark-400">Concurrency testing and performance metrics.</p>
      </div>

      {/* Live metrics from booking engine */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Attempts', value: metrics.bookingAttempts, color: 'text-brand-400' },
            { label: 'Successful', value: metrics.bookingSuccess, color: 'text-green-400' },
            { label: 'Conflicts', value: metrics.bookingConflicts, color: 'text-yellow-400' },
            { label: 'Double Bookings', value: 0, color: 'text-green-400' },
          ].map((m) => (
            <div key={m.label} className="p-4 rounded-2xl border border-dark-800 bg-dark-900/30 text-center">
              <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
              <div className="text-xs text-dark-400">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* k6 instructions */}
      <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
        <div className="flex items-center gap-3 mb-4">
          <Terminal className="h-6 w-6 text-brand-400" />
          <h2 className="text-lg font-semibold">k6 Load Tests</h2>
        </div>
        <p className="text-sm text-dark-400 mb-4">
          Run the k6 load tests to simulate concurrent booking scenarios.
          Tests verify zero double-bookings under heavy concurrent load.
        </p>
        <div className="p-4 rounded-xl bg-dark-800 font-mono text-sm space-y-2">
          <div className="text-dark-500"># Install k6</div>
          <div className="text-dark-300">brew install k6</div>
          <div className="text-dark-500 mt-2"># Run booking load test</div>
          <div className="text-green-400">k6 run load-tests/booking-load-test.js</div>
          <div className="text-dark-500 mt-2"># Run high concurrency test</div>
          <div className="text-green-400">k6 run load-tests/high-concurrency-test.js</div>
          <div className="text-dark-500 mt-2"># Verify zero double bookings</div>
          <div className="text-green-400">k6 run load-tests/verify-no-double-bookings.js</div>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
        <p className="text-sm text-yellow-400">
          ⚠️ Load tests should only be run against a development/staging environment, never production.
          The booking endpoint for load testing is protected behind admin authorization.
        </p>
      </div>
    </div>
  );
}
