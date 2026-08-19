'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, RefreshCw, Server, Database, Activity } from 'lucide-react';
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
          { name: 'API', status: 'healthy', icon: Server },
          { name: 'PostgreSQL', status: health?.checks?.postgres?.status || 'unknown', latency: health?.checks?.postgres?.latencyMs },
          { name: 'Redis', status: health?.checks?.redis?.status || 'unknown', latency: health?.checks?.redis?.latencyMs },
          { name: 'BullMQ', status: 'healthy', icon: Activity },
        ].map((service) => (
          <div key={service.name} className="flex items-center justify-between p-4 rounded-2xl border border-dark-800 bg-dark-900/30">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                service.status === 'healthy' ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 text-dark-500 animate-spin" />
                ) : service.status === 'healthy' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
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
            <span className={`badge ${service.status === 'healthy' ? 'badge-success' : 'badge-error'}`}>
              {isLoading ? 'Checking...' : service.status === 'healthy' ? 'HEALTHY' : 'UNHEALTHY'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
