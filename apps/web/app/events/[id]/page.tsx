'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ArrowLeft,
  ShoppingCart,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import { SeatMap } from '@/components/seats/seat-map';
import { toast } from '@/components/ui/toast';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const eventId = params.id as string;

  const [selectedSeats, setSelectedSeats] = useState<
    Array<{ id: string; seatNumber: string; row: string; section: string; price: number }>
  >([]);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Fetch event details
  const { data: eventRes, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => apiClient.getEvent(eventId),
  });

  // Fetch seats
  const { data: seatsRes, isLoading: seatsLoading, refetch: refetchSeats } = useQuery({
    queryKey: ['seats', eventId],
    queryFn: () => apiClient.getSeats(eventId),
  });

  const event = (eventRes as any)?.data;
  const seats = (seatsRes as any)?.data || [];

  // Group seats by row
  const seatsByRow = seats.reduce((acc: Record<string, any[]>, seat: any) => {
    if (!acc[seat.row]) acc[seat.row] = [];
    acc[seat.row].push(seat);
    return acc;
  }, {} as Record<string, any[]>);

  // Handle seat selection
  const toggleSeat = (seat: any) => {
    if (seat.status !== 'AVAILABLE') return;

    setSelectedSeats((prev) => {
      const exists = prev.find((s) => s.id === seat.id);
      if (exists) return prev.filter((s) => s.id !== seat.id);
      if (prev.length >= 10) {
        toast({ title: 'Maximum 10 seats per booking', type: 'error' });
        return prev;
      }
      return [...prev, seat];
    });
  };

  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Handle booking
  const handleBooking = async () => {
    if (!user || !token) {
      router.push('/login');
      return;
    }

    if (selectedSeats.length === 0) {
      toast({ title: 'Please select at least one seat', type: 'error' });
      return;
    }

    setIsBooking(true);
    setBookingError(null);

    try {
      const idempotencyKey = `booking_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const result: any = await apiClient.createBooking(
        { eventId, seatIds: selectedSeats.map((s) => s.id) },
        token,
        idempotencyKey,
      );

      toast({ title: 'Booking confirmed!', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['seats', eventId] });
      setSelectedSeats([]);
      router.push(`/booking/${result.data.bookingId}`);
    } catch (err: any) {
      const message = err.message || 'Booking failed';
      setBookingError(message);
      toast({ title: message, type: 'error' });
      refetchSeats();
    } finally {
      setIsBooking(false);
    }
  };

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
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h2 className="text-xl font-medium mb-2">Event not found</h2>
        <Link href="/events" className="text-brand-400 hover:underline">Browse Events</Link>
      </div>
    );
  }

  const Link2 = require('next/link').Link;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <Link2 href="/events" className="inline-flex items-center gap-2 text-sm text-dark-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Link2>

      {/* Event header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="badge badge-info">{event.category}</span>
              <span className="badge badge-success">{event.status}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{event.name}</h1>
            <p className="text-dark-400 max-w-2xl">{event.description}</p>
          </div>

          {/* Availability */}
          <div className="p-4 rounded-2xl border border-dark-800 bg-dark-900/50 text-center min-w-[160px]">
            <div className="text-3xl font-bold text-brand-400">
              {event.availableSeats ?? event.totalSeats}
            </div>
            <div className="text-xs text-dark-400">/ {event.totalSeats} seats</div>
            <div className="mt-2">
              <span className="badge badge-success">AVAILABLE</span>
            </div>
          </div>
        </div>

        {/* Event info */}
        <div className="flex flex-wrap gap-6 mt-6 text-sm text-dark-400">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formatDate(event.eventDate)}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {event.startTime} — {event.endTime}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {event.venue}, {event.city}
          </div>
        </div>
      </div>

      {/* Seat map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Select Your Seats</h2>
          {seatsLoading ? (
            <div className="skeleton h-96 w-full rounded-2xl" />
          ) : (
            <SeatMap
              seatsByRow={seatsByRow}
              selectedSeats={selectedSeats}
              onToggleSeat={toggleSeat}
            />
          )}
        </div>

        {/* Booking sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 p-6 rounded-2xl border border-dark-800 bg-dark-900/50">
            <h3 className="font-semibold mb-4">Booking Summary</h3>

            {selectedSeats.length === 0 ? (
              <p className="text-sm text-dark-400 py-4 text-center">
                Click seats on the map to select them
              </p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {selectedSeats.map((seat) => (
                    <div key={seat.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{seat.seatNumber}</span>
                        <span className="text-dark-500 ml-2">{seat.section}</span>
                      </div>
                      <span className="text-dark-300">{formatCurrency(seat.price)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dark-700 pt-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total</span>
                    <span className="text-xl font-bold text-brand-400">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                {bookingError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {bookingError}
                  </div>
                )}

                <button
                  onClick={handleBooking}
                  disabled={isBooking}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed"
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Book {selectedSeats.length} Seat{selectedSeats.length > 1 ? 's' : ''}
                    </>
                  )}
                </button>

                <p className="text-xs text-dark-500 text-center mt-3">
                  Booking uses PostgreSQL row-level locking for concurrency safety.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
