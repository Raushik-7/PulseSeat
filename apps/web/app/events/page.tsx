'use client';

import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  X,
  Ticket,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { CitySelect } from '@/components/ui/city-select';
import { EventCard } from '@/components/events/event-card';

const categories = ['Music', 'Technology', 'Comedy', 'Film', 'Sports', 'Dance'];

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-20 text-center text-dark-400">Loading events...</div>}>
      <EventsContent />
    </Suspense>
  );
}

function EventsContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [city, setCity] = useState(() => searchParams.get('city') || '');
  const [page, setPage] = useState(1);

  // Keep filters in sync with URL params (navbar category links, homepage search, city selector)
  useEffect(() => {
    setCategory(searchParams.get('category') || '');
  }, [searchParams]);

  useEffect(() => {
    setCity(searchParams.get('city') || '');
  }, [searchParams]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  const params: Record<string, string> = { page: String(page), limit: '12' };
  if (search) params.search = search;
  if (category) params.category = category;
  if (city) params.city = city;

  const { data, isLoading } = useQuery({
    queryKey: ['events', params],
    queryFn: () => apiClient.getEvents(params),
  });

  const events = (data as any)?.data || [];
  const pagination = (data as any)?.pagination;
  const hasFilters = !!(search || category || city);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {category || city ? 'Filtered Events' : 'All Events'}
        </h1>
        <p className="text-dark-400">
          {hasFilters ? 'Showing results matching your filters' : 'Discover upcoming events and book your seats'}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 p-4 rounded-2xl border border-dark-800 bg-dark-900/50">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search by name, venue, or city..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
            />
          </div>

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <CitySelect
            value={city}
            onChange={(c) => { setCity(c); setPage(1); }}
            allowAll
            className="sm:w-48"
          />

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setCategory(''); setCity(''); setPage(1); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-dark-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {/* Active filter tags */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            {search && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-medium border border-brand-500/20">
                &quot;{search}&quot;
                <button onClick={() => setSearch('')} className="hover:text-white"><X className="h-3 w-3" /></button>
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-medium border border-brand-500/20">
                {category}
                <button onClick={() => setCategory('')} className="hover:text-white"><X className="h-3 w-3" /></button>
              </span>
            )}
            {city && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-medium border border-brand-500/20">
                {city}
                <button onClick={() => setCity('')} className="hover:text-white"><X className="h-3 w-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-dark-800 overflow-hidden">
              <div className="skeleton h-48 w-full" />
              <div className="p-5 space-y-3">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Events grid */}
      {!isLoading && events.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event: any) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${
                    p === page
                      ? 'bg-brand-500 text-white'
                      : 'bg-dark-800 text-dark-400 hover:bg-dark-700 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <div className="text-center py-20">
          <Ticket className="h-14 w-14 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium mb-2">
            {hasFilters ? 'No events match your filters' : 'No events available'}
          </h3>
          <p className="text-dark-400 text-sm mb-6 max-w-md mx-auto">
            {hasFilters
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Check back soon — new events are added regularly.'}
          </p>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setCategory(''); setCity(''); setPage(1); }}
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
