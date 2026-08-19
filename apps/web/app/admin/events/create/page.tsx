'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AdminCreateEventPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push('/login');
    else if (!isAdmin) router.push('/');
  }, [user, isAdmin, router]);

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Create Event</h1>

      <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
        <p className="text-dark-400">
          Event creation is available through the API. Use the admin API to create events:
        </p>
        <pre className="mt-4 p-4 rounded-xl bg-dark-800 font-mono text-sm text-dark-300 overflow-x-auto">
{`POST /api/v1/admin/events
Authorization: Bearer <admin-token>

{
  "name": "My Event",
  "category": "Music",
  "venue": "Arena",
  "city": "Mumbai",
  "eventDate": "2026-12-01T00:00:00Z",
  "startTime": "18:00",
  "endTime": "23:00",
  "seatCount": 200
}`}
        </pre>
      </div>
    </div>
  );
}
