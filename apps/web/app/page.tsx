'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ArrowRight,
  Music,
  Laptop,
  Laugh,
  Film,
  Trophy,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { CitySelect } from '@/components/ui/city-select';
import { EventCard } from '@/components/events/event-card';
import { Logo } from '@/components/ui/logo';

const categoryConfig = [
  { name: 'Music', icon: Music, color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/20', href: '/events?category=Music' },
  { name: 'Technology', icon: Laptop, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20', href: '/events?category=Technology' },
  { name: 'Comedy', icon: Laugh, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20', href: '/events?category=Comedy' },
  { name: 'Film', icon: Film, color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20', href: '/events?category=Film' },
  { name: 'Sports', icon: Trophy, color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20', href: '/events?category=Sports' },
  { name: 'Dance', icon: Sparkles, color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20', href: '/events?category=Dance' },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Fetch all published events
  const { data: eventsRes, isLoading } = useQuery({
    queryKey: ['home-all-events'],
    queryFn: () => apiClient.getEvents({ limit: '50' }),
  });

  const allEvents = (eventsRes as any)?.data || [];

  // Group events by category
  const eventsByCategory: Record<string, any[]> = {};
  allEvents.forEach((event: any) => {
    const cat = event.category;
    if (!eventsByCategory[cat]) eventsByCategory[cat] = [];
    eventsByCategory[cat].push(event);
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedCity) params.set('city', selectedCity);
    router.push(`/events?${params.toString()}`);
  };

  return (
    <div>
      {/* ── Hero + Search ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* 3D mesh background */}
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-brand-500/5 via-transparent to-transparent" />
          <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[150px] animate-float" />
          <div className="absolute top-20 right-1/6 w-[400px] h-[400px] bg-purple-500/8 rounded-full blur-[120px]" style={{animationDelay: '1s'}} />
          <div className="absolute -bottom-20 left-1/2 w-[500px] h-[300px] bg-pink-500/5 rounded-full blur-[100px]" style={{animationDelay: '2s'}} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-14">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live events happening now
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 leading-tight">
              Find your next{' '}
              <span className="gradient-text">experience.</span>
            </h1>
            <p className="text-lg text-dark-400 max-w-xl mx-auto">
              Discover concerts, sports, comedy, film and dance events across India
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl border border-dark-700/50 bg-dark-900/80 backdrop-blur-sm shadow-2xl shadow-black/30 glow-brand">
              <div className="flex items-center gap-2 flex-1 px-3">
                <Search className="h-5 w-5 text-dark-500 shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search events, artists, venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search events"
                  className="flex-1 bg-transparent text-white placeholder:text-dark-500 text-sm focus:outline-none py-2"
                />
              </div>
              <div className="hidden sm:block px-1 border-l border-dark-700">
                <CitySelect
                  value={selectedCity}
                  onChange={setSelectedCity}
                  allowAll
                  className="w-44"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl text-sm font-semibold transition-all shrink-0 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Trending / All Events ─────────────────────────────────── */}
      <section className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">Trending Events</h2>
              <p className="text-dark-400 text-sm mt-1">Popular events everyone&apos;s talking about</p>
            </div>
            <Link
              href="/events"
              className="flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              View all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-dark-800 overflow-hidden">
                  <div className="skeleton h-44 w-full" />
                  <div className="p-4 space-y-3">
                    <div className="skeleton h-5 w-3/4" />
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {allEvents.slice(0, 8).map((event: any) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          {!isLoading && allEvents.length === 0 && (
            <div className="text-center py-16">
              <Ticket className="h-12 w-12 text-dark-600 mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-lg font-medium mb-2">No events available yet</h3>
              <p className="text-dark-400 text-sm">Check back soon for upcoming events.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Category Sections ─────────────────────────────────────── */}
      {categoryConfig.map((cat) => {
        const catEvents = eventsByCategory[cat.name] || [];
        if (catEvents.length === 0) return null;

        return (
          <section key={cat.name} className="py-10 border-t border-dark-800/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${cat.bgColor} border ${cat.borderColor}`}>
                    <cat.icon className={`h-5 w-5 ${cat.color}`} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{cat.name}</h2>
                    <p className="text-dark-400 text-xs">{catEvents.length} event{catEvents.length !== 1 ? 's' : ''} available</p>
                  </div>
                </div>
                <Link
                  href={cat.href}
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
                >
                  View all
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {catEvents.slice(0, 4).map((event: any) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section className="py-16 border-t border-dark-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-500/5 rounded-full blur-[120px]" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px]" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-4">How to book</h2>
          <p className="text-dark-400 text-center mb-12 text-sm">Three simple steps to your next experience</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Browse events', desc: 'Find concerts, sports, comedy shows and more near you.', icon: '🎭' },
              { step: '2', title: 'Pick your seats', desc: 'Choose the best available seats from an interactive seat map.', icon: '💺' },
              { step: '3', title: 'Get your tickets', desc: 'Pay securely and receive instant confirmation. Done!', icon: '🎫' },
            ].map((item) => (
              <div key={item.step} className="text-center p-6 rounded-2xl border border-dark-800/50 bg-dark-900/30 hover:bg-dark-900/50 transition-colors">
                <div className="text-3xl mb-3" aria-hidden="true">{item.icon}</div>
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/10 text-brand-400 text-xs font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-1.5">{item.title}</h3>
                <p className="text-sm text-dark-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-16 border-t border-dark-800/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 via-transparent to-purple-500/5" aria-hidden="true" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-brand-500/8 rounded-full blur-[100px]" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold mb-3">Don&apos;t miss out</h2>
          <p className="text-dark-400 mb-8">
            Browse events happening in your city and book before they sell out.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all hover:shadow-xl hover:shadow-brand-500/25 animate-pulse-glow"
          >
            Explore Events
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-dark-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <div className="mb-4">
                <Logo href={null} />
              </div>
              <p className="text-sm text-dark-400 leading-relaxed">
                Discover and book live events — concerts, sports, comedy, theatre and more.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-4 text-white">Explore</h3>
              <div className="space-y-2.5">
                <Link href="/events" className="block text-sm text-dark-400 hover:text-white transition-colors">All Events</Link>
                <Link href="/events?category=Music" className="block text-sm text-dark-400 hover:text-white transition-colors">Concerts</Link>
                <Link href="/events?category=Sports" className="block text-sm text-dark-400 hover:text-white transition-colors">Sports</Link>
                <Link href="/events?category=Comedy" className="block text-sm text-dark-400 hover:text-white transition-colors">Comedy</Link>
                <Link href="/events?category=Technology" className="block text-sm text-dark-400 hover:text-white transition-colors">Tech Events</Link>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-4 text-white">Company</h3>
              <div className="space-y-2.5">
                <Link href="/about" className="block text-sm text-dark-400 hover:text-white transition-colors">About Us</Link>
                <Link href="/contact" className="block text-sm text-dark-400 hover:text-white transition-colors">Contact</Link>
                <Link href="/help" className="block text-sm text-dark-400 hover:text-white transition-colors">Help &amp; Support</Link>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-4 text-white">Account</h3>
              <div className="space-y-2.5">
                <Link href="/bookings" className="block text-sm text-dark-400 hover:text-white transition-colors">My Bookings</Link>
                <Link href="/profile" className="block text-sm text-dark-400 hover:text-white transition-colors">Profile</Link>
                <Link href="/login" className="block text-sm text-dark-400 hover:text-white transition-colors">Log in</Link>
                <Link href="/signup" className="block text-sm text-dark-400 hover:text-white transition-colors">Sign up</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-dark-800/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-dark-500">
              © 2026 PulseSeat. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Terms of Service</Link>
              <Link href="/refund-policy" className="text-xs text-dark-500 hover:text-dark-300 transition-colors">Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
