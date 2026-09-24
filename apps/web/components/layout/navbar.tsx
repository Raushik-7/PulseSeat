'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import {
  Menu, X, LogOut, User, ChevronDown, LayoutDashboard, Calendar,
  BookOpen, BarChart3, HeartPulse, HelpCircle, Mail, Info,
  Music, Laptop, Laugh, Film, Trophy, Sparkles, Home,
  Search, Camera, Settings, Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { CitySelect } from '@/components/ui/city-select';

const ALL_CATEGORIES = ['Music', 'Technology', 'Comedy', 'Film', 'Sports', 'Dance'];

const categories = [
  { name: 'Music', icon: Music, color: 'text-pink-400', activeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30', href: '/events?category=Music' },
  { name: 'Technology', icon: Laptop, color: 'text-blue-400', activeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30', href: '/events?category=Technology' },
  { name: 'Comedy', icon: Laugh, color: 'text-yellow-400', activeColor: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', href: '/events?category=Comedy' },
  { name: 'Film', icon: Film, color: 'text-purple-400', activeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30', href: '/events?category=Film' },
  { name: 'Sports', icon: Trophy, color: 'text-green-400', activeColor: 'bg-green-500/15 text-green-400 border-green-500/30', href: '/events?category=Sports' },
  { name: 'Dance', icon: Sparkles, color: 'text-orange-400', activeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30', href: '/events?category=Dance' },
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/system', label: 'System', icon: HeartPulse },
];

function NavbarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout, isAdmin } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');

  const cityHref = selectedCity ? `/events?city=${encodeURIComponent(selectedCity)}` : '/events';

  const activeCategory = searchParams.get('category') || '';

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-dark-950/95 backdrop-blur-xl border-b border-dark-800/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3">
            {/* Logo */}
            <Logo />

            {/* Desktop: Category nav icons */}
            <div className="hidden lg:flex items-center gap-1">
              <Link
                href="/"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  pathname === '/' && !activeCategory
                    ? 'bg-dark-800 text-white'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800/50',
                )}
              >
                <Home className="h-3.5 w-3.5" />
                Home
              </Link>
              {categories.map((cat) => {
                const isActive = activeCategory === cat.name;
                return (
                  <Link
                    key={cat.name}
                    href={cat.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-transparent',
                      isActive
                        ? cat.activeColor
                        : 'text-dark-400 hover:text-white hover:bg-dark-800/50',
                    )}
                  >
                    <cat.icon className="h-3.5 w-3.5" />
                    {cat.name}
                  </Link>
                );
              })}
              {user && (
                <Link
                  href="/bookings"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    pathname === '/bookings'
                      ? 'bg-dark-800 text-white'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800/50',
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  My Bookings
                </Link>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">
              {/* City selector */}
              <CitySelect
                value={selectedCity}
                onChange={setSelectedCity}
                allowAll
                className="hidden md:block w-44"
              />

              {/* Auth buttons */}
              <div className="hidden md:flex items-center gap-2">
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-dark-800/50 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shadow-md shadow-brand-500/20">
                        <span className="text-[11px] font-bold text-white">
                          {user.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <ChevronDown className="h-3 w-3 text-dark-500" />
                    </button>
                    {userMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-dark-700 bg-dark-900 shadow-2xl z-50 overflow-hidden">
                          <div className="px-4 py-3 border-b border-dark-800 bg-dark-900/50">
                            <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                            <p className="text-xs text-dark-500 truncate">{user.email}</p>
                          </div>
                          <div className="py-1">
                            <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">
                              <User className="h-4 w-4" /> Profile
                            </Link>
                            <Link href="/bookings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">
                              <BookOpen className="h-4 w-4" /> My Bookings
                            </Link>
                            <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">
                              <Camera className="h-4 w-4" /> Upload Photo
                            </Link>
                            <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">
                              <Settings className="h-4 w-4" /> Settings
                            </Link>
                          </div>
                          <div className="border-t border-dark-800 py-1">
                            <button
                              onClick={() => { logout(); setUserMenuOpen(false); }}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-dark-800 w-full transition-colors"
                            >
                              <LogOut className="h-4 w-4" /> Log out
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <Link href="/login" className="px-3 py-1.5 text-xs font-medium text-dark-300 hover:text-white transition-colors">
                      Log in
                    </Link>
                    <Link href="/signup" className="px-4 py-1.5 text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-white rounded-lg transition-all shadow-md shadow-brand-500/20">
                      Sign up
                    </Link>
                  </>
                )}
              </div>

              {/* Hamburger */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800/50 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hamburger Drawer ── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-dark-900 border-l border-dark-800 shadow-2xl z-[70] animate-slide-left overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-800">
              <Logo href={null} />
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {user && (
              <div className="px-5 py-4 border-b border-dark-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                    <span className="text-sm font-bold text-white">{user.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-dark-500">{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-3 py-3">
              <p className="px-3 py-1 text-[10px] font-semibold text-dark-500 uppercase tracking-wider">Navigate</p>
              <Link href="/" onClick={() => setDrawerOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  pathname === '/' ? 'bg-dark-800 text-white' : 'text-dark-300 hover:bg-dark-800/50 hover:text-white')}>
                <Home className="h-4 w-4" /> Home
              </Link>
              <Link href={cityHref} onClick={() => setDrawerOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  pathname === '/events' ? 'bg-dark-800 text-white' : 'text-dark-300 hover:bg-dark-800/50 hover:text-white')}>
                <Search className="h-4 w-4" /> All Events{selectedCity ? ` in ${selectedCity}` : ''}
              </Link>
              {user && (
                <Link href="/bookings" onClick={() => setDrawerOpen(false)}
                  className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    pathname === '/bookings' ? 'bg-dark-800 text-white' : 'text-dark-300 hover:bg-dark-800/50 hover:text-white')}>
                  <BookOpen className="h-4 w-4" /> My Bookings
                </Link>
              )}
            </div>

            <div className="px-3 py-2 border-t border-dark-800">
              <p className="px-3 py-1 text-[10px] font-semibold text-dark-500 uppercase tracking-wider">Categories</p>
              <div className="grid grid-cols-2 gap-2 px-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.name}
                    href={cat.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                      activeCategory === cat.name
                        ? cat.activeColor
                        : 'border-dark-700/50 bg-dark-800/30 hover:bg-dark-800 text-dark-300 hover:text-white'
                    )}
                  >
                    <cat.icon className={cn('h-4 w-4', cat.color)} />
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="px-3 py-2 border-t border-dark-800">
              <p className="px-3 py-1 text-[10px] font-semibold text-dark-500 uppercase tracking-wider">Account</p>
              {user ? (
                <>
                  <Link href="/profile" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-300 hover:bg-dark-800/50 hover:text-white transition-colors">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <Link href="/profile" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-300 hover:bg-dark-800/50 hover:text-white transition-colors">
                    <Camera className="h-4 w-4" /> Upload Photo
                  </Link>
                  <Link href="/profile" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-300 hover:bg-dark-800/50 hover:text-white transition-colors">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                  <button onClick={() => { logout(); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-dark-800/50 w-full transition-colors">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </>
              ) : (
                <div className="px-3 py-2 space-y-2">
                  <Link href="/login" onClick={() => setDrawerOpen(false)} className="block text-center px-4 py-2.5 text-sm font-medium border border-dark-700 rounded-xl hover:bg-dark-800 text-dark-300 hover:text-white transition-colors">
                    Log in
                  </Link>
                  <Link href="/signup" onClick={() => setDrawerOpen(false)} className="block text-center px-4 py-2.5 text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-white rounded-xl transition-colors shadow-md shadow-brand-500/20">
                    Sign up
                  </Link>
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-t border-dark-800">
              <p className="px-3 py-1 text-[10px] font-semibold text-dark-500 uppercase tracking-wider">More</p>
              <Link href="/about" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:bg-dark-800/50 hover:text-white transition-colors">
                <Info className="h-4 w-4" /> About Us
              </Link>
              <Link href="/contact" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:bg-dark-800/50 hover:text-white transition-colors">
                <Mail className="h-4 w-4" /> Contact
              </Link>
              <Link href="/help" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:bg-dark-800/50 hover:text-white transition-colors">
                <HelpCircle className="h-4 w-4" /> Help & Support
              </Link>
            </div>

            {isAdmin && (
              <div className="px-3 py-2 border-t border-dark-800">
                <p className="px-3 py-1 text-[10px] font-semibold text-dark-500 uppercase tracking-wider">
                  <Shield className="h-3 w-3 inline mr-1" /> Admin
                </p>
                {adminLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setDrawerOpen(false)}
                    className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      pathname === link.href ? 'bg-dark-800 text-white' : 'text-dark-400 hover:bg-dark-800/50 hover:text-white')}>
                    <link.icon className="h-4 w-4" /> {link.label}
                  </Link>
                ))}
              </div>
            )}

            <div className="px-5 py-4 border-t border-dark-800 mt-auto">
              <p className="text-[10px] text-dark-600 text-center">&copy; 2026 PulseSeat. All rights reserved.</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={<nav className="sticky top-0 z-50 bg-dark-950/95 backdrop-blur-xl border-b border-dark-800/40 h-14" />}>
      <NavbarInner />
    </Suspense>
  );
}
