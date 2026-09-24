import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
}

/** PulseSeat brand mark — rounded ticket silhouette with a pulse wave. */
export function LogoMark({ size = 'md', className }: { size?: LogoProps['size']; className?: string }) {
  const box = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  return (
    <div
      className={cn(
        box,
        'relative flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-indigo-500 to-purple-600 shadow-lg shadow-brand-500/25',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className={size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]'} aria-hidden="true">
        {/* ticket body */}
        <path
          d="M4 8.5C4 7.12 5.12 6 6.5 6h11C18.88 6 20 7.12 20 8.5v1.05a2.45 2.45 0 0 0 0 4.9v1.05c0 1.38-1.12 2.5-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-1.05a2.45 2.45 0 0 0 0-4.9V8.5Z"
          fill="white"
          fillOpacity="0.95"
        />
        {/* perforation */}
        <line x1="14.5" y1="7" x2="14.5" y2="17" stroke="url(#psg)" strokeWidth="1.2" strokeDasharray="1.6 1.6" />
        {/* pulse wave */}
        <path
          d="M6.5 12h1.8l1.2-2.4 1.6 4.4 1.2-2h1.7"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="psg" x1="14" y1="7" x2="15" y2="17" gradientUnits="userSpaceOnUse">
            <stop stopColor="#94a3b8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function Logo({ size = 'md', showWordmark = true, href = '/', className }: LogoProps) {
  const content = (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className={cn(
            'font-bold tracking-tight text-white',
            size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base',
          )}
        >
          Pulse<span className="text-brand-400">Seat</span>
        </span>
      )}
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} aria-label="PulseSeat home" className="shrink-0">
      {content}
    </Link>
  );
}
