'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Ticket,
  Users,
  Info,
  Sparkles,
  Navigation,
  Image as ImageIcon,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency, categoryColor, categoryEmoji } from '@/lib/utils';
import { eventCover, eventGallery, eventAlt } from '@/lib/event-visuals';
import { SeatMap } from '@/components/seats/seat-map';
import { EventCardCompact } from '@/components/events/event-card';
import { toast } from '@/components/ui/toast';
import { useSeatUpdates } from '@/hooks/use-seat-updates';
import Link from 'next/link';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const eventId = params.id as string;

  const [selectedSeats, setSelectedSeats] = useState<
    Array<{ id: string; seatNumber: string; row: string; section: string; price: number; status: string }>
  >([]);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // ─── WebSocket Real-Time Updates ────────────────────────────────────────
  const { onBulkSeatUpdate } = useSeatUpdates(eventId);

  useEffect(() => {
    const unsub = onBulkSeatUpdate((data) => {
      if (data.eventId !== eventId) return;

      queryClient.setQueryData(['seats', eventId], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((seat: any) => {
            const update = data.updates.find((u) => u.seatId === seat.id);
            if (update) return { ...seat, status: update.status };
            return seat;
          }),
        };
      });

      const bookedIds = new Set(
        data.updates.filter((u) => u.status !== 'AVAILABLE').map((u) => u.seatId),
      );
      if (bookedIds.size > 0) {
        setSelectedSeats((prev) => {
          const removed = prev.filter((s) => bookedIds.has(s.id));
          if (removed.length > 0) {
            toast({
              title: 'This seat is no longer available. Please select another seat.',
              type: 'error',
            });
          }
          return prev.filter((s) => !bookedIds.has(s.id));
        });
      }
    });
    return unsub;
  }, [eventId, onBulkSeatUpdate, queryClient]);

  // ─── Data ──────────────────────────────────────────────────────────

  const { data: eventRes, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiClient.getEvent(eventId),
  });

  const { data: seatsRes, isLoading: seatsLoading } = useQuery({
    queryKey: ['seats', eventId],
    queryFn: () => apiClient.getSeats(eventId),
  });

  const { data: allEventsRes } = useQuery({
    queryKey: ['events', 'similar'],
    queryFn: () => apiClient.getEvents({ limit: '50' }),
  });

  const event = (eventRes as any)?.data;
  const seats = (seatsRes as any)?.data || [];

  const seatsByRow = seats.reduce((acc: Record<string, any[]>, seat: any) => {
    if (!acc[seat.row]) acc[seat.row] = [];
    acc[seat.row].push(seat);
    return acc;
  }, {} as Record<string, any[]>);

  // ─── Seat Selection ─────────────────────────────────────────────────

  const toggleSeat = useCallback((seat: any) => {
    if (seat.status !== 'AVAILABLE') return;

    setSelectedSeats((prev) => {
      const exists = prev.find((s) => s.id === seat.id);
      if (exists) return prev.filter((s) => s.id !== seat.id);
      if (prev.length >= 10) {
        toast({ title: 'You can select up to 10 seats at a time', type: 'error' });
        return prev;
      }
      return [...prev, seat];
    });
  }, []);

  const totalAmount = selectedSeats.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const convenienceFee = Math.round(totalAmount * 0.02);
  const grandTotal = totalAmount + convenienceFee;

  // ─── Booking ────────────────────────────────────────────────────────

  const handleBooking = async () => {
    if (!user || !token) {
      router.push('/login');
      return;
    }
    if (selectedSeats.length === 0) {
      toast({ title: 'Please select at least one seat', type: 'error' });
      return;
    }

    // Redirect to checkout page
    const params = new URLSearchParams({
      eventId,
      seatIds: selectedSeats.map((s) => s.id).join(','),
      amount: String(grandTotal),
    });
    router.push(`/checkout?${params.toString()}`);
  };

  // ─── Loading ────────────────────────────────────────────────────────

  if (eventLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="skeleton h-64 w-full rounded-2xl mb-8" />
        <div className="skeleton h-8 w-1/2 mb-4" />
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <Ticket className="h-14 w-14 text-dark-600 mx-auto mb-4" />
        <h2 className="text-xl font-medium mb-2">Event not found</h2>
        <Link href="/events" className="text-brand-400 hover:underline text-sm">Browse Events</Link>
      </div>
    );
  }

  const available = event.availableSeats ?? event.totalSeats;
  const isSoldOut = available <= 0;
  const catClass = categoryColor(event.category);
  const gallery = eventGallery(event);
  const highlights: string[] = (event as any).highlights || [];

  // Similar events: same category, excluding current
  const similarEvents = ((allEventsRes as any)?.data || [])
    .filter((e: any) => e.category === event.category && e.id !== event.id)
    .slice(0, 3);

  const priceTierSummary = Object.entries(
    seats.reduce((acc: Record<string, { min: number; count: number }>, seat: any) => {
      const key = seat.section;
      if (!acc[key]) acc[key] = { min: Number(seat.price), count: 0 };
      acc[key].min = Math.min(acc[key].min, Number(seat.price));
      if (seat.status === 'AVAILABLE') acc[key].count++;
      return acc;
    }, {} as Record<string, { min: number; count: number }>),
  ).sort((a: any, b: any) => a[1].min - b[1].min) as Array<[string, { min: number; count: number }]>;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Back */}
      <Link href="/events" className="inline-flex items-center gap-2 text-sm text-dark-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Link>

      {/* Hero Banner */}
      <div className="relative h-56 sm:h-80 rounded-2xl overflow-hidden mb-8 bg-dark-800">
        <img
          src={eventCover(event)}
          alt={eventAlt(event, 0)}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className={`badge ${catClass}`}>{categoryEmoji(event.category)} {event.category}</span>
            {!isSoldOut && available < 20 && (
              <span className="badge badge-warning">Few seats left</span>
            )}
            {isSoldOut && <span className="badge badge-error">Sold out</span>}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-1">{event.name}</h1>
          {(event as any).shortDescription && (
            <p className="text-dark-200 text-sm max-w-2xl">{(event as any).shortDescription}</p>
          )}
        </div>
      </div>

      {/* Event Info */}
      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-8 text-sm text-dark-400">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-brand-400" />
          {formatDate(event.eventDate)}
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-brand-400" />
          {event.startTime} — {event.endTime}
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-brand-400" />
          {event.venue}, {event.city}
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-brand-400" />
          {isSoldOut ? 'Sold out' : `${available} seats available`}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: description, highlights, gallery, venue, seats */}
        <div className="lg:col-span-2 space-y-10">
          {/* About */}
          {event.description && (
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-xl font-semibold mb-3">About the event</h2>
              <p className="text-dark-300 leading-relaxed whitespace-pre-line">{event.description}</p>
              <p className="mt-3 text-xs text-dark-500">
                This is a demo listing created for the PulseSeat portfolio project — event details are sample
                data and do not imply affiliation with the artists or venues named.
              </p>
            </section>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <section aria-labelledby="highlights-heading">
              <h2 id="highlights-heading" className="text-xl font-semibold mb-4">Event highlights</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl border border-dark-800 bg-dark-900/40 px-4 py-3 text-sm text-dark-300"
                  >
                    <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Gallery */}
          <section aria-labelledby="gallery-heading">
            <h2 id="gallery-heading" className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-brand-400" aria-hidden="true" />
              Gallery
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-dark-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  aria-label={`View ${eventAlt(event, i)}`}
                >
                  <img
                    src={src}
                    alt={eventAlt(event, i)}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </button>
              ))}
            </div>
          </section>

          {/* Venue info */}
          <section aria-labelledby="venue-heading">
            <h2 id="venue-heading" className="text-xl font-semibold mb-4">Venue information</h2>
            <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <MapPin className="h-5 w-5 text-brand-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{event.venue}</p>
                  <p className="text-sm text-dark-400 mt-0.5">
                    {(event as any).address || `${event.venue}, ${event.city}`}
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue} ${(event as any).address || event.city}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Ticket pricing tiers */}
          {priceTierSummary.length > 0 && (
            <section aria-labelledby="pricing-heading">
              <h2 id="pricing-heading" className="text-xl font-semibold mb-4">Ticket pricing</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {priceTierSummary.map(([section, info]) => (
                  <div
                    key={section}
                    className={`rounded-xl border p-4 ${
                      section === 'VIP'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : section === 'PREMIUM'
                          ? 'border-brand-500/30 bg-brand-500/5'
                          : 'border-dark-700 bg-dark-900/40'
                    }`}
                  >
                    <p className="text-sm font-medium text-dark-300">
                      {section === 'VIP' && '👑 '}
                      {section === 'PREMIUM' && '✦ '}
                      {section}
                    </p>
                    <p className="text-lg font-bold text-white mt-1">{formatCurrency(info.min)}</p>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {info.count > 0 ? `${info.count} seats available` : 'Sold out'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Seat Map */}
          {!isSoldOut && (
            <section aria-labelledby="seats-heading">
              <h2 id="seats-heading" className="text-xl font-semibold mb-4">Select your seats</h2>
              {seatsLoading ? (
                <div className="skeleton h-96 w-full rounded-2xl" />
              ) : (
                <SeatMap
                  seatsByRow={seatsByRow}
                  selectedSeats={selectedSeats}
                  onToggleSeat={toggleSeat}
                />
              )}
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 p-6 rounded-2xl border border-dark-800 bg-dark-900/50">
            <h3 className="font-semibold mb-4">Your selection</h3>

            {selectedSeats.length === 0 ? (
              <p className="text-sm text-dark-400 py-6 text-center">
                Click on available seats to select them
              </p>
            ) : (
              <>
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {selectedSeats.map((seat) => (
                    <div key={seat.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{seat.seatNumber}</span>
                        <span className="text-dark-500 text-xs">{seat.section}</span>
                      </div>
                      <span className="text-dark-300">{formatCurrency(Number(seat.price))}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dark-700 pt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-400">
                      {selectedSeats.length} ticket{selectedSeats.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-dark-300">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-400">Convenience fee (2%)</span>
                    <span className="text-dark-300">{formatCurrency(convenienceFee)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dark-700">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-brand-400">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {bookingError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <button
                  onClick={handleBooking}
                  disabled={isBooking}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed mt-4 shadow-lg shadow-brand-500/20"
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Checkout — {formatCurrency(grandTotal)}
                    </>
                  )}
                </button>

                <p className="text-xs text-dark-500 text-center mt-3 flex items-center justify-center gap-1.5">
                  <Info className="h-3 w-3" />
                  Seats are held for 15 minutes during checkout
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sold out state */}
      {isSoldOut && (
        <div className="text-center py-16 rounded-2xl border border-dark-800 bg-dark-900/30">
          <Ticket className="h-14 w-14 text-dark-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium mb-2">This event is sold out</h2>
          <p className="text-dark-400 text-sm mb-6">Check back later or explore other events.</p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Browse Other Events
          </Link>
        </div>
      )}

      {/* Similar events */}
      {similarEvents.length > 0 && (
        <section className="mt-14" aria-labelledby="similar-heading">
          <h2 id="similar-heading" className="text-xl font-semibold mb-5">Similar events</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {similarEvents.map((e: any) => (
              <EventCardCompact key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-dark-800/80 p-2.5 text-white hover:bg-dark-700 transition-colors"
            onClick={() => setLightbox(null)}
            aria-label="Close image viewer"
          >
            ✕
          </button>
          <img
            src={gallery[lightbox]}
            alt={eventAlt(event, lightbox)}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
