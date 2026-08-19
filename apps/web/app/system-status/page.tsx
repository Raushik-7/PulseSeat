'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function SystemStatusPage() {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealthReady(),
    refetchInterval: 30000,
  });

  const health = data as any;

  useEffect(() => {
    setLastChecked(new Date());
  }, [data]);

  const checks = [
    { name: 'API', key: 'api', healthy: true },
    { name: 'PostgreSQL', key: 'postgres', healthy: health?.checks?.postgres?.status === 'healthy' },
    { name: 'Redis', key: 'redis', healthy: health?.checks?.redis?.status === 'healthy' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2">System Status</h1>
        <p className="text-dark-400">Real-time health status of PulseSeat infrastructure.</p>
      </div>

      <div className="space-y-3">
        {checks.map((check) => (
          <div
            key={check.name}
            className="flex items-center justify-between p-5 rounded-2xl border border-dark-800 bg-dark-900/30"
          >
            <div className="flex items-center gap-3">
              {isLoading ? (
                <Loader2 className="h-5 w-5 text-dark-500 animate-spin" />
              ) : check.healthy ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              <div>
                <div className="font-medium">{check.name}</div>
                {health?.checks?.[check.key]?.latencyMs !== undefined && (
                  <div className="text-xs text-dark-500">
                    Latency: {health.checks[check.key].latencyMs}ms
                  </div>
                )}
              </div>
            </div>
            <span
              className={`badge ${
                isLoading ? 'badge-neutral' : check.healthy ? 'badge-success' : 'badge-error'
              }`}
            >
              {isLoading ? 'Checking...' : check.healthy ? 'Operational' : 'Degraded'}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-dark-500 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Checking...'}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-sm text-dark-300 hover:text-white hover:border-dark-500 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
    </div>
  );
}
