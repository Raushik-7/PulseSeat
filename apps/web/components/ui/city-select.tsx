'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const INDIAN_CITIES = [
  'Mumbai', 'New Delhi', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata',
  'Ahmedabad', 'Jaipur', 'Chandigarh', 'Indore', 'Goa', 'Lucknow', 'Kochi',
];

interface CitySelectProps {
  value: string;
  onChange: (city: string) => void;
  /** When true, includes an "All cities" clear option (for filters). */
  allowAll?: boolean;
  label?: string;
  className?: string;
}

export function CitySelect({ value, onChange, allowAll = false, label, className }: CitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const cities = allowAll ? ['', ...INDIAN_CITIES] : INDIAN_CITIES;
  const filtered = cities.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  const pick = useCallback(
    (city: string) => {
      onChange(city);
      setOpen(false);
    },
    [onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight] !== undefined) pick(filtered[highlight]); }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label || 'Select city'}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl border border-dark-700 bg-dark-800 px-3 py-2.5 text-sm transition-all',
          'hover:border-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
          open && 'border-brand-500/60 ring-2 ring-brand-500/30',
        )}
      >
        <MapPin className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />
        <span className={cn('flex-1 truncate text-left', value ? 'text-white' : 'text-dark-500')}>
          {value || 'All cities'}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-dark-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Cities"
          className="absolute z-50 mt-2 w-full min-w-[240px] overflow-hidden rounded-2xl border border-dark-700 bg-dark-900 shadow-2xl shadow-black/50 animate-dropdown"
        >
          <div className="border-b border-dark-800 p-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-500" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                role="searchbox"
                aria-label="Search city"
                placeholder="Search city..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
                className="w-full rounded-lg bg-dark-800 py-2 pl-9 pr-3 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-dark-500">No cities match “{query}”</p>
            )}
            {filtered.map((city, i) => (
              <button
                key={city || 'all'}
                type="button"
                role="option"
                aria-selected={city === value}
                onClick={() => pick(city)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  i === highlight ? 'bg-dark-800 text-white' : 'text-dark-300',
                  city === value && 'text-brand-400 font-medium',
                )}
              >
                {city ? (
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-dark-500" aria-hidden="true" />
                ) : null}
                <span className="flex-1 text-left">{city || 'All cities'}</span>
                {city === value && <Check className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
