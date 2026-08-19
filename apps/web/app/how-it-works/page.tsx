'use client';

import Link from 'next/link';
import {
  Shield,
  Database,
  Lock,
  Zap,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  GitBranch,
  RotateCcw,
} from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">
          How the Booking Engine{' '}
          <span className="gradient-text">Handles Concurrency</span>
        </h1>
        <p className="text-dark-400 max-w-2xl mx-auto text-lg">
          A deep look at how PulseSeat guarantees zero double-bookings under concurrent load.
        </p>
      </div>

      {/* The Problem */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">The Problem</h2>
        <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
          <p className="text-dark-300 leading-relaxed mb-4">
            When thousands of users try to book the same limited inventory simultaneously, a naive
            implementation creates a <strong className="text-red-400">race condition</strong>:
          </p>
          <div className="p-4 rounded-xl bg-dark-900/80 font-mono text-sm space-y-1">
            <div className="text-dark-500"># UNSAFE — DO NOT USE</div>
            <div className="text-yellow-400">User A: SELECT availability → 1 seat left</div>
            <div className="text-yellow-400">User B: SELECT availability → 1 seat left</div>
            <div className="text-yellow-400">User A: UPDATE seat → BOOKED ✓</div>
            <div className="text-yellow-400">User B: UPDATE seat → BOOKED ✓ ← DOUBLE BOOKING!</div>
            <div className="text-red-400 mt-2">Result: 2 bookings for 1 seat ✗</div>
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">The Solution</h2>
        <div className="p-6 rounded-2xl border border-green-500/20 bg-green-500/5">
          <p className="text-dark-300 leading-relaxed mb-4">
            PostgreSQL <strong className="text-green-400">pessimistic locking</strong> with{' '}
            <code className="px-1.5 py-0.5 rounded bg-dark-800 text-brand-400 font-mono text-xs">
              SELECT ... FOR UPDATE
            </code>{' '}
            ensures that only one transaction can modify a seat at a time.
          </p>
          <div className="p-4 rounded-xl bg-dark-900/80 font-mono text-sm space-y-1">
            <div className="text-dark-500"># SAFE — Production implementation</div>
            <div className="text-green-400">BEGIN TRANSACTION</div>
            <div className="text-green-400">SELECT * FROM seats WHERE id = X FOR UPDATE</div>
            <div className="text-green-400">  ↑ Row is locked. Other transactions WAIT.</div>
            <div className="text-green-400">IF seat.status != AVAILABLE → ROLLBACK</div>
            <div className="text-green-400">UPDATE seats SET status = BOOKED</div>
            <div className="text-green-400">INSERT INTO bookings ...</div>
            <div className="text-green-400">COMMIT</div>
            <div className="text-green-400 mt-2">Result: Exactly 1 booking for 1 seat ✓</div>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Step by Step</h2>
        <div className="space-y-4">
          {[
            {
              step: 1,
              title: 'Request enters API',
              desc: 'The user clicks Book. The request hits Fastify with JWT authentication.',
              icon: Zap,
              color: 'text-brand-400',
            },
            {
              step: 2,
              title: 'Rate limiting',
              desc: 'Redis-based rate limiting checks if this user has exceeded booking attempt limits.',
              icon: Shield,
              color: 'text-yellow-400',
            },
            {
              step: 3,
              title: 'Idempotency check',
              desc: 'If the client sends an Idempotency-Key, we check for duplicate requests.',
              icon: RotateCcw,
              color: 'text-blue-400',
            },
            {
              step: 4,
              title: 'PostgreSQL transaction begins',
              desc: 'A database transaction starts with READ COMMITTED isolation.',
              icon: Database,
              color: 'text-blue-400',
            },
            {
              step: 5,
              title: 'Lock seats with SELECT FOR UPDATE',
              desc: 'Requested seat rows are locked in ascending ID order to prevent deadlocks.',
              icon: Lock,
              color: 'text-green-400',
              highlight: true,
            },
            {
              step: 6,
              title: 'Check seat availability',
              desc: 'While holding the lock, verify all requested seats are AVAILABLE.',
              icon: CheckCircle,
              color: 'text-green-400',
            },
            {
              step: 7,
              title: 'Create booking and update seats',
              desc: 'Insert booking record, update seat status to BOOKED, all within the transaction.',
              icon: Users,
              color: 'text-brand-400',
            },
            {
              step: 8,
              title: 'Commit transaction',
              desc: 'Transaction commits. Locks are released. Other waiting transactions can proceed.',
              icon: CheckCircle,
              color: 'text-green-400',
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`flex gap-4 p-5 rounded-2xl border transition-colors ${
                item.highlight
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-dark-800 bg-dark-900/30 hover:border-dark-600'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dark-800 shrink-0">
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-dark-500">Step {item.step}</span>
                  {item.highlight && <span className="badge badge-success text-[10px]">Critical</span>}
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-dark-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Deadlock Prevention */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Deadlock Prevention</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold text-green-400 mb-3">✓ Deterministic Lock Order</h3>
            <p className="text-sm text-dark-400 mb-4">
              When locking multiple seats, we always lock in ascending seat ID order:
            </p>
            <div className="p-3 rounded-xl bg-dark-800 font-mono text-xs">
              <div className="text-dark-500">Requested: A10, A03, A07</div>
              <div className="text-green-400">Sorted: A03, A07, A10</div>
              <div className="text-dark-400">Lock in this order → No deadlock</div>
            </div>
          </div>
          <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/30">
            <h3 className="font-semibold text-red-400 mb-3">✗ Random Lock Order</h3>
            <p className="text-sm text-dark-400 mb-4">
              Without sorting, two users locking the same seats in different orders can deadlock:
            </p>
            <div className="p-3 rounded-xl bg-dark-800 font-mono text-xs">
              <div className="text-dark-500">User 1: Lock A10, then A03</div>
              <div className="text-dark-500">User 2: Lock A03, then A10</div>
              <div className="text-red-400">← Possible deadlock!</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="text-center py-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-brand-500/25"
        >
          Try It Yourself
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
