'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export interface SeatMapSeat {
  id: string;
  seatNumber: string;
  row: string;
  section: string;
  price: number;
  status: string;
}

interface SeatMapProps {
  seatsByRow: Record<string, SeatMapSeat[]>;
  selectedSeats: SeatMapSeat[];
  onToggleSeat: (seat: SeatMapSeat) => void;
}

export function SeatMap({ seatsByRow, selectedSeats, onToggleSeat }: SeatMapProps) {
  const selectedIds = new Set(selectedSeats.map((s) => s.id));
  const rows = Object.keys(seatsByRow).sort();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const allSeats = Object.values(seatsByRow).flat();
  const sectionPrices = (['VIP', 'PREMIUM', 'GENERAL'] as const)
    .map((section) => {
      const seatsInSection = allSeats.filter((s) => s.section === section);
      return { section, price: seatsInSection.length ? Math.min(...seatsInSection.map((s) => s.price)) : 0, count: seatsInSection.length };
    })
    .filter((s) => s.count > 0);

  return (
    <div className="rounded-2xl border border-dark-800 bg-dark-900/50 p-4 sm:p-6">
      <div className="overflow-x-auto pb-2" role="group" aria-label="Interactive seat map">
        <div className="min-w-fit mx-auto">
          {/* STAGE */}
          <div className="mb-6" aria-hidden="true">
            <div className="mx-auto w-2/3 min-w-[200px] h-10 rounded-b-3xl bg-gradient-to-b from-brand-500/25 to-transparent border border-brand-500/30 border-t-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-300 tracking-[0.3em] uppercase">Stage</span>
            </div>
            <div className="mx-auto mt-2 w-1/2 h-px bg-gradient-to-r from-transparent via-dark-600 to-transparent" />
          </div>

          {/* Seats */}
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row} className="flex items-center gap-2">
                <div className="w-8 text-center text-xs font-mono text-dark-500 select-none" aria-hidden="true">{row}</div>
                <div className="flex gap-1.5">
                  {seatsByRow[row]
                    .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber))
                    .map((seat) => {
                      const isSelected = selectedIds.has(seat.id);
                      const isAvailable = seat.status === 'AVAILABLE';
                      // Deterministic best-view: middle seats of VIP/PREMIUM
                      const seatNum = parseInt(seat.seatNumber.replace(seat.row, ''), 10) || 0;
                      const rowIndex = rows.indexOf(row);
                      const bestView =
                        isAvailable &&
                        rowIndex <= Math.min(3, rows.length - 1) &&
                        seatNum >= 6 &&
                        seatNum <= Math.max(9, Math.round(20 / 2) + 2);
                      const isBest = bestView || seat.section === 'VIP';

                      return (
                        <div key={seat.id} className="relative">
                          {isBest && isAvailable && (
                            <Star className="absolute -top-1.5 -right-1.5 h-3 w-3 text-amber-400 fill-amber-400 z-10" aria-hidden="true" />
                          )}
                          <button
                            onClick={() => onToggleSeat(seat)}
                            onMouseEnter={() => setActiveTooltip(seat.id)}
                            onMouseLeave={() => setActiveTooltip(null)}
                            onFocus={() => setActiveTooltip(seat.id)}
                            onBlur={() => setActiveTooltip(null)}
                            disabled={!isAvailable}
                            aria-label={`Seat ${seat.seatNumber}, ${seat.section}, ${formatCurrency(seat.price)}, ${isBest ? 'best view, ' : ''}${isAvailable ? 'available' : 'not available'}`}
                            aria-pressed={isSelected}
                            className={cn(
                              'seat',
                              isSelected ? 'seat-selected' : isBest && isAvailable ? 'seat-best' : undefined,
                              !isSelected && seat.status === 'AVAILABLE' && !isBest && 'seat-available',
                              seat.status === 'HELD' && 'seat-held',
                              seat.status === 'BOOKED' && 'seat-booked',
                              (seat.status === 'DISABLED' || (!isAvailable && seat.status !== 'HELD' && seat.status !== 'BOOKED')) && 'seat-disabled',
                            )}
                          >
                            {seat.seatNumber.replace(row, '')}
                          </button>
                          {activeTooltip === seat.id && (
                            <div
                              role="tooltip"
                              className="absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-xs shadow-xl pointer-events-none"
                            >
                              <p className="font-semibold text-white">{seat.seatNumber} · {seat.section}</p>
                              <p className="text-dark-300">{formatCurrency(Number(seat.price))}</p>
                              {isBest && <p className="text-amber-400 mt-0.5">⭐ Best view</p>}
                              {!isAvailable && <p className="text-red-400 mt-0.5">Not available</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend — icons + text, not color-only */}
      <div className="mt-6 pt-4 border-t border-dark-800">
        <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
          {[
            { label: 'Available', class: 'seat-available' },
            { label: 'Best view', class: 'seat-best' },
            { label: 'Selected', class: 'seat-selected' },
            { label: 'Held', class: 'seat-held' },
            { label: 'Booked', class: 'seat-booked' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs text-dark-400">
              <span className={cn('seat w-5 h-5 text-[9px]', item.class)} aria-hidden="true">·</span>
              {item.label}
            </div>
          ))}
        </div>

        {/* Section pricing chips */}
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          {sectionPrices.map(({ section, price }) => (
            <div
              key={section}
              className={cn(
                'px-3 py-1.5 rounded-lg bg-dark-800 border text-xs',
                section === 'VIP' ? 'border-amber-500/30' : section === 'PREMIUM' ? 'border-brand-500/30' : 'border-dark-600',
              )}
            >
              <span className="font-medium">
                {section === 'VIP' && '👑 '}
                {section === 'PREMIUM' && '✦ '}
                {section}
              </span>
              <span className="text-dark-400 ml-1">from {formatCurrency(price)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
