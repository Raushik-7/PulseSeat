'use client';

import { Ticket, Shield, Zap, Users, Heart, Target, Award } from 'lucide-react';
import Link from 'next/link';

const values = [
  {
    icon: Shield,
    title: 'Trust & Security',
    desc: 'Every transaction is protected with industry-standard encryption. Your data and payments are always safe.',
  },
  {
    icon: Zap,
    title: 'Instant Confirmation',
    desc: 'No waiting, no uncertainty. Book your tickets and receive instant confirmation with your digital tickets.',
  },
  {
    icon: Users,
    title: 'For Everyone',
    desc: 'Whether it\'s a concert, a cricket match, or a comedy show — we make it easy for anyone to discover and book live events.',
  },
  {
    icon: Heart,
    title: 'Customer First',
    desc: 'Every feature we build starts with a simple question: does this make booking easier for our customers?',
  },
];

const stats = [
  { value: '50K+', label: 'Happy Customers' },
  { value: '200+', label: 'Events Hosted' },
  { value: '1M+', label: 'Tickets Sold' },
  { value: '99.9%', label: 'Uptime' },
];

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-dark-900 to-dark-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/20 mb-6">
            <Ticket className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">
            Making live events{' '}
            <span className="gradient-text">accessible to everyone</span>
          </h1>
          <p className="text-lg text-dark-400 max-w-2xl mx-auto">
            PulseSeat was built to solve a simple problem: booking tickets should be fast, fair, and frustration-free.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-dark-400 leading-relaxed mb-4">
                We believe everyone deserves a fair chance to get tickets to the events they love. No bots, no scalpers, no frustrating crashes when tickets go on sale.
              </p>
              <p className="text-dark-400 leading-relaxed">
                PulseSeat uses modern technology to handle massive booking traffic while keeping every transaction fair and secure. When thousands of people try to book the same seat, only one gets it — instantly, transparently.
              </p>
            </div>
            <div className="rounded-2xl border border-dark-800 bg-dark-900/50 p-8">
              <div className="flex items-center gap-3 mb-4">
                <Target className="h-5 w-5 text-brand-400" />
                <h3 className="font-bold">What we stand for</h3>
              </div>
              <ul className="space-y-3 text-sm text-dark-400">
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">✓</span>
                  <span>Fair access — first come, first served, no shortcuts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">✓</span>
                  <span>Transparent pricing — no hidden fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">✓</span>
                  <span>Instant confirmation — your tickets, immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">✓</span>
                  <span>Secure payments — your data is encrypted</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">✓</span>
                  <span>Easy refunds — cancel anytime before the event</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-t border-dark-800/50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-dark-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 border-t border-dark-800/50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.map((val) => (
              <div key={val.title} className="rounded-2xl border border-dark-800 bg-dark-900/50 p-6">
                <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                  <val.icon className="h-5 w-5 text-brand-400" />
                </div>
                <h3 className="font-bold mb-2">{val.title}</h3>
                <p className="text-sm text-dark-400">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-dark-800/50">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <Award className="h-10 w-10 text-brand-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Ready to find your next experience?</h2>
          <p className="text-dark-400 mb-8">
            Browse hundreds of events happening near you and book your seats in seconds.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-brand-500/20"
          >
            Explore Events
          </Link>
        </div>
      </section>
    </div>
  );
}
