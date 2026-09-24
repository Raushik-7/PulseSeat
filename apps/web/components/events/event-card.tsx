'use client';

import Link from 'next/link';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate, categoryColor, cn } from '@/lib/utils';
import { eventGallery, eventAlt } from '@/lib/event-visuals';
import { ImageCarousel } from '@/components/ui/image-carousel';

export interface EventCardEvent {
  id: string;
  name: string;
  category: string;
  venue: string;
  city: string;
  eventDate: string | Date;
  startTime?: string;
  totalSeats?: number;
  availableSeats?: number;
  minPrice?: number;
  bannerUrl?: string | null;
  galleryUrls?: string[] | null;
  shortDescription?: string | null;
}

export function EventCard({ event, showAvailabilityBar = true }: { event: EventCardEvent; showAvailabilityBar?: boolean }) {
  const catClass = categoryColor(event.category);
  const available = event.availableSeats ?? event.totalSeats ?? 0;
  const isSoldOut = available <= 0;
  const images = eventGallery(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group rounded-2xl border border-dark-800 overflow-hidden card-hover bg-dark-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      aria-label={`${event.name} — ${event.category} in ${event.city}`}
    >
      <ImageCarousel
        images={images}
        alt={eventAlt(event, 0)}
        className="h-48"
      />

      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${catClass}`}>{event.category}</span>
          {isSoldOut && <span className="badge badge-error">Sold out</span>}
        </div>
        <h3 className="font-semibold text-lg mb-1 group-hover:text-brand-400 transition-colors line-clamp-1">
          {event.name}
        </h3>
        {event.shortDescription && (
          <p className="text-xs text-dark-500 mb-3 line-clamp-2 leading-relaxed">{event.shortDescription}</p>
        )}

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-sm text-dark-400">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {formatDate(event.eventDate)} · {event.startTime}
          </div>
          <div className="flex items-center gap-2 text-sm text-dark-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.venue}, {event.city}</span>
          </div>
        </div>

        {showAvailabilityBar && event.totalSeats ? (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-dark-500 mb-1">
              <span>{isSoldOut ? 'Sold out' : `${available} seats available`}</span>
            </div>
            <div
              className="h-1.5 bg-dark-800 rounded-full overflow-hidden"
              role="progressbar"
              aria-label={`${available} of ${event.totalSeats} seats available`}
              aria-valuenow={available}
              aria-valuemin={0}
              aria-valuemax={event.totalSeats}
            >
              <div
                className={`h-full rounded-full transition-all ${isSoldOut ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${Math.max(4, ((event.totalSeats - available) / event.totalSeats) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-2 border-t border-dark-800/50">
          <div>
            <span className="text-xs text-dark-500">From</span>
            <span className="text-sm font-semibold text-white ml-1">{formatCurrency(event.minPrice || 0)}</span>
          </div>
          <span className="text-sm font-medium text-brand-400 group-hover:text-brand-300 flex items-center gap-1 transition-colors">
            {isSoldOut ? 'Sold Out' : 'View Tickets'}
            {!isSoldOut && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Compact horizontal variant used in "similar events" rails. */
export function EventCardCompact({ event }: { event: EventCardEvent }) {
  const catClass = categoryColor(event.category);
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex gap-3 rounded-xl border border-dark-800 bg-dark-900/40 p-3 hover:ring-1 hover:ring-brand-500/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      aria-label={event.name}
    >
      <img
        src={eventCoverSafe(event)}
        alt={eventAlt(event, 0)}
        className="h-16 w-24 rounded-lg object-cover shrink-0"
        loading="lazy"
      />
      <div className="min-w-0">
        <span className={`badge ${catClass} mb-1`}>{event.category}</span>
        <h4 className="font-medium text-sm truncate group-hover:text-brand-400 transition-colors">{event.name}</h4>
        <p className="text-xs text-dark-500 truncate mt-0.5">
          {formatDate(event.eventDate)} · {event.city}
        </p>
      </div>
    </Link>
  );
}

function eventCoverSafe(event: EventCardEvent): string {
  return event.bannerUrl || eventGallery(event)[0];
}

export { cn };
