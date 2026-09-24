'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { User, Mail, Shield, Calendar, LogOut, ChevronRight, Ticket } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>

      {/* Profile card */}
      <div className="rounded-2xl border border-dark-800 bg-dark-900/30 overflow-hidden mb-6">
        <div className="h-2 bg-gradient-to-r from-brand-500 to-brand-400" />
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <User className="h-8 w-8 text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-dark-400">{user.email}</p>
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
                <div className="text-sm capitalize">{user.role.toLowerCase()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <Link
          href="/bookings"
          className="flex items-center justify-between p-4 rounded-xl border border-dark-800 bg-dark-900/30 hover:border-dark-600 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Ticket className="h-5 w-5 text-dark-400" />
            <div>
              <div className="font-medium text-sm">My Bookings</div>
              <div className="text-xs text-dark-500">View your upcoming and past bookings</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-dark-500" />
        </Link>

        <button
          onClick={() => { logout(); router.push('/'); }}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-dark-800 bg-dark-900/30 hover:border-red-500/20 hover:bg-red-500/5 text-red-400 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <div className="text-left">
            <div className="font-medium text-sm">Log out</div>
            <div className="text-xs text-dark-500">Sign out of your account</div>
          </div>
        </button>
      </div>
    </div>
  );
}
