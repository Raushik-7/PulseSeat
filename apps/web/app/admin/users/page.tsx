'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';

export default function AdminUsersPage() {
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.getAdminUsers(token!),
    enabled: !!token && isAdmin,
  });

  const users = (data as any)?.data || [];

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Users</h1>
        <p className="text-dark-400">Manage system users and roles.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : users.length > 0 ? (
        <div className="rounded-2xl border border-dark-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-800 bg-dark-900/50">
                <th className="text-left px-4 py-3 font-medium text-dark-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-dark-400">Email</th>
                <th className="text-left px-4 py-3 font-medium text-dark-400">Role</th>
                <th className="text-left px-4 py-3 font-medium text-dark-400">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-b border-dark-800/50 hover:bg-dark-900/30">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-dark-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-info' : 'badge-neutral'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dark-400">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No users</h3>
        </div>
      )}
    </div>
  );
}
