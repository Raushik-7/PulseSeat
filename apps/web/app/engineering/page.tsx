'use client';

import Link from 'next/link';
import {
  Database,
  Server,
  Layers,
  Zap,
  Globe,
  Terminal,
  Activity,
  BarChart3,
  Shield,
  Lock,
  GitBranch,
  ArrowRight,
  Clock,
  RotateCcw,
  Cpu,
} from 'lucide-react';

export default function EngineeringPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Engineering Deep Dive</h1>
        <p className="text-dark-400 max-w-2xl mx-auto text-lg">
          Technical architecture decisions behind PulseSeat — built to demonstrate
          production-grade concurrency engineering.
        </p>
      </div>

      {/* Architecture cards */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Architecture Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Database, name: 'PostgreSQL', desc: 'Source of truth. Transactions, row-level locking, constraints.', color: 'text-blue-400' },
            { icon: Server, name: 'Redis', desc: 'Cache layer, rate limiting, idempotency keys, session store.', color: 'text-red-400' },
            { icon: Layers, name: 'BullMQ', desc: 'Async background jobs: emails, invoices, analytics, expiration.', color: 'text-orange-400' },
            { icon: Zap, name: 'Fastify', desc: 'High-throughput API server. Pino structured logging.', color: 'text-brand-400' },
            { icon: Globe, name: 'Next.js', desc: 'React frontend with SSR, App Router, TanStack Query.', color: 'text-white' },
            { icon: Terminal, name: 'k6', desc: 'Load testing. Simulates thousands of concurrent bookings.', color: 'text-pink-400' },
            { icon: Activity, name: 'Prometheus', desc: 'Application metrics. Booking attempts, success, conflicts.', color: 'text-orange-300' },
            { icon: BarChart3, name: 'Grafana', desc: 'Metrics visualization. System health dashboards.', color: 'text-yellow-400' },
          ].map((tech) => (
            <div key={tech.name} className="p-5 rounded-2xl border border-dark-800 bg-dark-900/30 hover:border-dark-600 transition-colors group">
              <tech.icon className={`h-8 w-8 mb-3 ${tech.color} group-hover:scale-110 transition-transform`} />
              <h3 className="font-semibold mb-1">{tech.name}</h3>
              <p className="text-xs text-dark-400 leading-relaxed">{tech.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Concurrency Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Lock className="h-6 w-6 text-green-400" />
          Concurrency Control
        </h2>
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold mb-2">PostgreSQL Pessimistic Locking</h3>
            <p className="text-sm text-dark-400 leading-relaxed mb-3">
              Every booking uses <code className="px-1.5 py-0.5 rounded bg-dark-800 text-brand-400 font-mono text-xs">SELECT ... FOR UPDATE</code> to
              acquire an exclusive row lock before checking or modifying seat status.
              This is the standard database-level approach to preventing concurrent modification.
            </p>
            <p className="text-sm text-dark-400 leading-relaxed">
              Unlike optimistic locking (which retries on conflict), pessimistic locking serializes
              access to contested rows, making conflicts explicit and avoiding wasted work.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold mb-2">Deterministic Lock Ordering</h3>
            <p className="text-sm text-dark-400 leading-relaxed">
              When locking multiple seats, seat IDs are sorted in ascending order before acquiring locks.
              This eliminates deadlocks caused by two transactions locking the same resources in different orders.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold mb-2">Atomic Multi-Seat Booking</h3>
            <p className="text-sm text-dark-400 leading-relaxed">
              If any requested seat is unavailable, the entire transaction rolls back. No partial bookings.
              This is enforced at the application level and reinforced by database constraints.
            </p>
          </div>
        </div>
      </section>

      {/* Rate Limiting */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Shield className="h-6 w-6 text-yellow-400" />
          Rate Limiting
        </h2>
        <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
          <p className="text-sm text-dark-400 leading-relaxed mb-4">
            Redis-based sliding window rate limiting protects the API from abuse.
            Different endpoints have different limits:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { endpoint: 'General API', limit: '100 req/min/user' },
              { endpoint: 'Booking', limit: '10 attempts/min/user' },
              { endpoint: 'Login', limit: '5 attempts/min/IP' },
            ].map((rule) => (
              <div key={rule.endpoint} className="p-3 rounded-xl bg-dark-800">
                <div className="text-sm font-medium">{rule.endpoint}</div>
                <div className="text-xs text-dark-400 font-mono">{rule.limit}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Idempotency */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-blue-400" />
          Idempotency
        </h2>
        <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
          <p className="text-sm text-dark-400 leading-relaxed">
            Clients can send an <code className="px-1.5 py-0.5 rounded bg-dark-800 text-brand-400 font-mono text-xs">Idempotency-Key</code> header
            with booking requests. The server stores the result in Redis with a configurable TTL.
            If the same key is received again, the cached result is returned without re-executing the booking.
            This prevents duplicate bookings caused by network retries.
          </p>
        </div>
      </section>

      {/* Database */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Database className="h-6 w-6 text-blue-400" />
          Database Design
        </h2>
        <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
          <p className="text-sm text-dark-400 leading-relaxed mb-4">
            PostgreSQL is the single source of truth. The schema uses:
          </p>
          <ul className="space-y-2 text-sm text-dark-400">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">•</span>
              <span><strong className="text-white">UNIQUE constraints</strong> — on (event_id, seat_number) and booking_reference</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">•</span>
              <span><strong className="text-white">Foreign keys</strong> — with CASCADE deletes for data integrity</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">•</span>
              <span><strong className="text-white">Strategic indexes</strong> — on query patterns: event lookups, user bookings, seat availability</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-1">•</span>
              <span><strong className="text-white">Row-level locking</strong> — SELECT FOR UPDATE within transactions</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Background Jobs */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Layers className="h-6 w-6 text-orange-400" />
          Background Processing
        </h2>
        <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
          <p className="text-sm text-dark-400 leading-relaxed">
            BullMQ + Redis handles non-critical operations asynchronously:
            confirmation emails, invoice generation, analytics aggregation, and seat hold expiration.
            The booking response is returned immediately after the database transaction commits.
            Background job failures are retryable and do not affect booking correctness.
          </p>
        </div>
      </section>

      <div className="text-center py-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all"
        >
          Try It Live
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
