'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Zap,
  Calendar,
  BookOpen,
  Info,
  Activity,
  LayoutDashboard,
  Users,
  BarChart3,
  HeartPulse,
  FlaskConical,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const publicLinks = [
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/how-it-works', label: 'How It Works', icon: Info },
  { href: '/system-status', label: 'System Status', icon: Activity },
];

const userLinks = [
  { href: '/bookings', label: 'My Bookings', icon: BookOpen },
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/system', label: 'System', icon: HeartPulse },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const links = [...publicLinks, ...(user ? userLinks : [])];

  return (
    <nav className="sticky top-0 z-50 border-b border-dark-800/50 bg-dark-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 group-hover:bg-brand-400 transition-colors">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">PulseSeat</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-dark-800 text-white'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800/50',
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}

            {/* Admin dropdown */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-brand-400 hover:bg-dark-800/50 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Admin
                  <ChevronDown className="h-3 w-3" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-1 w-48 rounded-xl border border-dark-700 bg-dark-900 shadow-xl">
                    {adminLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setProfileOpen(false)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl',
                          pathname === link.href
                            ? 'bg-dark-800 text-white'
                            : 'text-dark-400 hover:bg-dark-800 hover:text-white',
                        )}
                      >
                        <link.icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
                >
                  <User className="h-4 w-4" />
                  {user.name}
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-dark-400 hover:bg-dark-800 hover:text-red-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-dark-300 hover:text-white transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 text-sm font-medium bg-brand-500 hover:bg-brand-400 text-white rounded-lg transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-dark-400 hover:bg-dark-800"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-dark-800 bg-dark-900/95 backdrop-blur-xl animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium',
                  pathname === link.href
                    ? 'bg-dark-800 text-white'
                    : 'text-dark-400 hover:bg-dark-800/50 hover:text-white',
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <>
                <div className="pt-2 pb-1 px-3 text-xs font-semibold text-dark-500 uppercase tracking-wider">
                  Admin
                </div>
                {adminLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium',
                      pathname === link.href
                        ? 'bg-dark-800 text-white'
                        : 'text-dark-400 hover:bg-dark-800/50 hover:text-white',
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))}
              </>
            )}
            <div className="pt-3 border-t border-dark-800">
              {user ? (
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-dark-800 w-full"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              ) : (
                <div className="flex gap-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-4 py-2.5 text-sm border border-dark-700 rounded-lg hover:bg-dark-800">
                    Log in
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-4 py-2.5 text-sm bg-brand-500 rounded-lg hover:bg-brand-400">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
