'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Shield, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-brand-500/10 flex items-center justify-center">
            <User className="h-8 w-8 text-brand-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user.name}</h2>
            <span className={`badge ${user.role === 'ADMIN' ? 'badge-info' : 'badge-neutral'}`}>
              {user.role}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50">
            <Mail className="h-4 w-4 text-dark-400" />
            <div>
              <div className="text-xs text-dark-500">Email</div>
              <div className="text-sm">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50">
            <Shield className="h-4 w-4 text-dark-400" />
            <div>
              <div className="text-xs text-dark-500">Role</div>
              <div className="text-sm">{user.role}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
