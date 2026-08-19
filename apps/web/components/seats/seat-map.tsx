'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface Seat {
  id: string;
  seatNumber: string;
  row: string;
  section: string;
  price: number;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'DISABLED';
}

interface SeatMapProps {
  seatsByRow: Record<string, Seat[]>;
  selectedSeats: Seat[];
  onToggleSeat: (seat: Seat) => void;
}

const statusColors: Record<string, string> = {
  AVAILABLE: 'seat-available',
  HELD: 'seat-held',
  BOOKED: 'seat-booked',
  DISABLED: 'seat-disabled',
};

const sectionColors: Record<string, string> = {
  VIP: 'border-yellow-500/30',
  PREMIUM: 'border-brand-500/30',
  GENERAL: 'border-dark-600',
};

export function SeatMap({ seatsByRow, selectedSeats, onToggleSeat }: SeatMapProps) {
  const selectedIds = new Set(selectedSeats.map((s) => s.id));
  const rows = Object.keys(seatsByRow).sort();

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/50 p-6 overflow-x-auto">
      {/* Stage */}
      <div className="mb-8">
        <div className="mx-auto w-2/3 h-8 rounded-b-3xl bg-gradient-to-b from-brand-500/20 to-transparent border border-brand-500/20 border-t-0 flex items-center justify-center">
          <span className="text-xs font-medium text-brand-400 tracking-widest uppercase">Stage</span>
        </div>
      </div>

      {/* Seats */}
      <div className="space-y-2 min-w-fit mx-auto">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-2">
            <div className="w-8 text-center text-xs font-mono text-dark-500">{row}</div>
            <div className="flex gap-1.5">
              {seatsByRow[row]
                .sort((a: Seat, b: Seat) => a.seatNumber.localeCompare(b.seatNumber))
                .map((seat: Seat) => {
                  const isSelected = selectedIds.has(seat.id);
                  const isAvailable = seat.status === 'AVAILABLE';

                  return (
                    <button
                      key={seat.id}
                      onClick={() => onToggleSeat(seat)}
                      disabled={!isAvailable}
                      title={`${seat.seatNumber} — ${seat.section} — ${formatCurrency(seat.price)} — ${seat.status}`}
                      className={cn(
                        'seat',
                        isSelected ? 'seat-selected' : statusColors[seat.status] || 'seat-disabled',
                      )}
                    >
                      {seat.seatNumber.replace(row, '')}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-4 border-t border-dark-800">
        <div className="flex flex-wrap gap-4 justify-center">
          {[
            { label: 'Available', class: 'seat-available' },
            { label: 'Selected', class: 'seat-selected' },
            { label: 'Held', class: 'seat-held' },
            { label: 'Booked', class: 'seat-booked' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs text-dark-400">
              <div className={cn('seat w-5 h-5 text-[10px]', item.class)}>·</div>
              {item.label}
            </div>
          ))}
        </div>

        {/* Section info */}
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          {['VIP', 'PREMIUM', 'GENERAL'].map((section) => {
            const sectionSeats = Object.values(seatsByRow)
              .flat()
              .filter((s: Seat) => s.section === section);
            const price = sectionSeats[0]?.price || 0;
            return (
              <div
                key={section}
                className={cn(
                  'px-3 py-1.5 rounded-lg bg-dark-800 border text-xs',
                  sectionColors[section],
                )}
              >
                <span className="font-medium">{section}</span>
                <span className="text-dark-400 ml-1">from {formatCurrency(price)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
