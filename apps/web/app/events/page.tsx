'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Calendar, MapPin, Users, Search, Filter, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function EventsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);

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

  const categories = ['Technology', 'Music', 'Comedy', 'Film', 'Sports', 'Dance'];
  const cities = ['Bangalore', 'Mumbai', 'Pune', 'Delhi', 'Kolkata', 'Chennai'];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Events</h1>
        <p className="text-dark-400">Browse upcoming events and book your seats.</p>
      </div>

      {/* Filters */}
      <div className="mb-8 p-4 rounded-2xl border border-dark-800 bg-dark-900/50">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
            />
          </div>

          {/* Category */}
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* City */}
          <select
            value={city}
            onChange={(e) => { setCity(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="">All Cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {(search || category || city) && (
            <button
              onClick={() => { setSearch(''); setCategory(''); setCity(''); setPage(1); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-dark-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event: any) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-2xl border border-dark-800 overflow-hidden card-hover"
              >
                {/* Banner */}
                <div className="h-48 bg-gradient-to-br from-brand-500/20 to-dark-800 flex items-center justify-center relative">
                  <div className="text-6xl opacity-20 font-bold">
                    {event.name.charAt(0)}
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="badge badge-info">{event.category}</span>
                  </div>
                  {event.availableSeats !== undefined && (
                    <div className="absolute top-3 right-3">
                      <span className={`badge ${event.availableSeats > 0 ? 'badge-success' : 'badge-error'}`}>
                        {event.availableSeats > 0 ? `${event.availableSeats} seats` : 'Sold out'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-brand-400 transition-colors">
                    {event.name}
                  </h3>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-sm text-dark-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(event.eventDate)} · {event.startTime}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-dark-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.venue}, {event.city}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-dark-400">
                      <Users className="h-3.5 w-3.5" />
                      {event.availableSeats}/{event.totalSeats} available
                    </div>
                  </div>

                  {/* Availability bar */}
                  <div className="mb-3">
                    <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{
                          width: `${event.totalSeats > 0 ? ((event.totalSeats - event.availableSeats) / event.totalSeats) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="text-sm font-medium text-brand-400">
                    {event.availableSeats > 0 ? 'Book Now →' : 'Sold Out'}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
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
        <div className="text-center py-16">
          <Calendar className="h-12 w-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No events found</h3>
          <p className="text-dark-400 text-sm">Try adjusting your filters or search terms.</p>
        </div>
      )}
    </div>
  );
}
