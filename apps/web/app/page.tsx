import Link from 'next/link';
import {
  Zap,
  Shield,
  Database,
  Clock,
  Users,
  ArrowRight,
  Lock,
  GitBranch,
  Activity,
  Server,
  BarChart3,
  Globe,
  Terminal,
  Cpu,
  Layers,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/10 rounded-full blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-dark-700 bg-dark-900/50 text-sm text-dark-300 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400"></span>
            </span>
            Concurrency-safe ticket booking engine
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
            Built for the{' '}
            <span className="gradient-text">rush.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-dark-400 mb-10 leading-relaxed">
            A concurrency-safe ticket booking platform engineered to handle thousands of
            simultaneous booking attempts without double-booking a single seat.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/events"
              className="flex items-center gap-2 px-8 py-3.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-brand-500/25"
            >
              Explore Events
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="flex items-center gap-2 px-8 py-3.5 border border-dark-700 hover:border-dark-500 text-dark-300 hover:text-white rounded-xl font-semibold transition-all"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-16 border-t border-dark-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '5,000+', label: 'Concurrent Users', sublabel: 'Load test scenario' },
              { value: '0', label: 'Double Bookings', sublabel: 'Verified by PostgreSQL' },
              { value: '2,340', label: 'Requests/sec', sublabel: 'Simulation example' },
              { value: '99.99%', label: 'Booking Integrity', sublabel: 'Target benchmark' },
            ].map((metric) => (
              <div
                key={metric.label}
                className="text-center p-6 rounded-2xl border border-dark-800 bg-dark-900/30"
              >
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">{metric.value}</div>
                <div className="text-sm font-medium text-dark-300">{metric.label}</div>
                <div className="text-xs text-dark-500 mt-1">{metric.sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Flow */}
      <section className="py-20 border-t border-dark-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              What happens when everyone clicks{' '}
              <span className="text-brand-400">Book</span>?
            </h2>
            <p className="text-dark-400 max-w-2xl mx-auto">
              Every booking request flows through a carefully engineered pipeline that uses
              PostgreSQL transactions and row-level locking to guarantee consistency.
            </p>
          </div>

          <div className="relative">
            {/* Flow steps */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { icon: Users, title: 'User', desc: 'Clicks book button', color: 'text-blue-400' },
                { icon: Shield, title: 'Rate Limiter', desc: 'Redis-based limiting', color: 'text-yellow-400' },
                { icon: Zap, title: 'Fastify API', desc: 'High-throughput handling', color: 'text-brand-400' },
                { icon: Database, title: 'PostgreSQL', desc: 'Transaction + row lock', color: 'text-green-400' },
              ].map((step, i) => (
                <div key={step.title} className="relative">
                  <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/50 hover:border-dark-600 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-dark-800 ${step.color}`}>
                        <step.icon className="h-5 w-5" />
                      </div>
                      <div className="text-xs font-mono text-dark-500">Step {i + 1}</div>
                    </div>
                    <h3 className="font-semibold mb-1">{step.title}</h3>
                    <p className="text-sm text-dark-400">{step.desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:flex absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                      <ArrowRight className="h-5 w-5 text-dark-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* The critical step */}
            <div className="mt-8 p-6 rounded-2xl border-2 border-green-500/30 bg-green-500/5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 shrink-0">
                  <Lock className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-400 mb-1">SELECT FOR UPDATE</h3>
                  <p className="text-sm text-dark-300 leading-relaxed">
                    The seat row is locked with <code className="px-1.5 py-0.5 rounded bg-dark-800 text-brand-400 font-mono text-xs">SELECT ... FOR UPDATE</code>.
                    Only one transaction can hold the lock. Other concurrent requests wait.
                    The seat status is checked and updated atomically within the transaction.
                    If the seat is already booked, the entire transaction rolls back — no partial booking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why No Double Bookings */}
      <section className="py-20 border-t border-dark-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Why no double bookings?
              </h2>
              <div className="space-y-4">
                {[
                  'Request enters the API through rate limiting.',
                  'A PostgreSQL transaction begins.',
                  'The target seat row is locked with SELECT FOR UPDATE.',
                  'Availability is checked while the lock is held.',
                  'If available, the seat is updated and booking created.',
                  'Transaction commits — other requests must wait.',
                  'Only one transaction can successfully book the seat.',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-dark-300 text-sm leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Concurrency visualization */}
            <div className="p-6 rounded-2xl border border-dark-800 bg-dark-900/50 font-mono text-sm">
              <div className="text-dark-500 mb-3"># Concurrent booking scenario</div>
              <div className="space-y-2">
                <div className="text-blue-400">User 1 ──────────────┐</div>
                <div className="text-cyan-400">User 2 ──────────────┤</div>
                <div className="text-purple-400">User 3 ──────────────┤</div>
                <div className="text-pink-400">User 4 ──────────────┤</div>
                <div className="text-dark-500 pl-16">│</div>
                <div className="text-dark-500 pl-10">↓</div>
                <div className="text-brand-400 text-center">Booking API</div>
                <div className="text-dark-500 text-center">↓</div>
                <div className="text-green-400 text-center">PostgreSQL Transaction</div>
                <div className="text-dark-500 text-center">↓</div>
                <div className="text-green-400 text-center font-semibold">SELECT FOR UPDATE</div>
                <div className="text-dark-500 text-center">↓</div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="text-green-400 font-semibold">User 1</div>
                    <div className="text-xs text-green-300">✓ SUCCESS</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-red-400 font-semibold">Others</div>
                    <div className="text-xs text-red-300">✗ CONFLICT</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 border-t border-dark-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Engineering Stack</h2>
            <p className="text-dark-400">
              Each component chosen for a specific engineering reason.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, name: 'PostgreSQL', role: 'Source of truth', color: 'text-blue-400' },
              { icon: Server, name: 'Redis', role: 'Cache + rate limiting', color: 'text-red-400' },
              { icon: Layers, name: 'BullMQ', role: 'Async jobs', color: 'text-orange-400' },
              { icon: Zap, name: 'Fastify', role: 'High-throughput API', color: 'text-brand-400' },
              { icon: Globe, name: 'Next.js', role: 'Frontend', color: 'text-white' },
              { icon: Terminal, name: 'k6', role: 'Load testing', color: 'text-pink-400' },
              { icon: Activity, name: 'Prometheus', role: 'Metrics', color: 'text-orange-300' },
              { icon: BarChart3, name: 'Grafana', role: 'Visualization', color: 'text-yellow-400' },
            ].map((tech) => (
              <div
                key={tech.name}
                className="p-5 rounded-2xl border border-dark-800 bg-dark-900/30 hover:border-dark-600 transition-colors group"
              >
                <tech.icon className={`h-8 w-8 mb-3 ${tech.color} group-hover:scale-110 transition-transform`} />
                <h3 className="font-semibold mb-0.5">{tech.name}</h3>
                <p className="text-xs text-dark-500">{tech.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-dark-800/50">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to experience it?
          </h2>
          <p className="text-dark-400 mb-8 max-w-lg mx-auto">
            Browse events and book seats in a system designed for correctness first,
            performance second.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/events"
              className="flex items-center gap-2 px-8 py-3.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-brand-500/25"
            >
              Explore Events
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/engineering"
              className="flex items-center gap-2 px-8 py-3.5 border border-dark-700 hover:border-dark-500 text-dark-300 hover:text-white rounded-xl font-semibold transition-all"
            >
              <Terminal className="h-4 w-4" />
              Engineering Deep Dive
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-800/50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-dark-500 text-sm">
            <Zap className="h-4 w-4 text-brand-500" />
            PulseSeat — A concurrency-safe booking engine
          </div>
          <div className="text-xs text-dark-600">
            Built with PostgreSQL transactions, Redis caching, and architectural rigor.
          </div>
        </div>
      </footer>
    </div>
  );
}
