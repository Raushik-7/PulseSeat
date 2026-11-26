'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw, Server, Database } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function AdminSystemPage() {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => apiClient.getHealthReady(),
    refetchInterval: 15000,
  });

  const health = data as any;

  // Map backend dependency states onto three UI states. `/health/deps` reports
  // Redis as ok | degraded | disabled — only Postgres can be outright unhealthy.
  type UiState = 'healthy' | 'degraded' | 'unhealthy';
  const normalize = (raw?: string): UiState =>
    raw === 'ok' || raw === 'healthy' ? 'healthy' : raw === 'unhealthy' ? 'unhealthy' : 'degraded';

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">System Health</h1>
          <p className="text-dark-400">Infrastructure status and health checks.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800 border border-dark-700 text-sm text-dark-300 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* System components */}
      <div className="space-y-3 mb-8">
        {[
          { name: 'API', status: 'healthy' as UiState, icon: Server },
          { name: 'PostgreSQL', status: normalize(health?.checks?.postgres?.status), latency: health?.checks?.postgres?.latencyMs },
          // Redis is an optional cache: "degraded"/"disabled" is not an outage,
          // the app serves reads from Postgres.
          { name: 'Redis (optional cache)', status: normalize(health?.checks?.redis?.status), latency: health?.checks?.redis?.latencyMs },
          // BullMQ was removed: emails now drain from a Postgres outbox, so there
          // is no Redis-backed worker to report (and none polling Redis).
        ].map((service) => (
          <div key={service.name} className="flex items-center justify-between p-4 rounded-2xl border border-dark-800 bg-dark-900/30">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                service.status === 'healthy' ? 'bg-green-500/10' : service.status === 'degraded' ? 'bg-amber-500/10' : 'bg-red-500/10'
              }`}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 text-dark-500 animate-spin" />
                ) : service.status === 'healthy' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : service.status === 'degraded' ? (
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div>
                <div className="font-medium">{service.name}</div>
                {service.latency !== undefined && (
                  <div className="text-xs text-dark-500">Latency: {service.latency}ms</div>
                )}
              </div>
            </div>
            <span className={`badge ${service.status === 'healthy' ? 'badge-success' : service.status === 'degraded' ? 'badge-warning' : 'badge-error'}`}>
              {isLoading ? 'Checking...' : service.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
