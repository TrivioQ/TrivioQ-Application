'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useAuth } from '../context/auth-provider';
import { useUserProfile } from '../hooks/use-user-profile';

// ─── Framer variants ──────────────────────────────────────────────────────────

const mobileMenuVariants: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.25, ease: 'easeInOut' },
  },
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.14, ease: 'easeIn' },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(displayName: string | null, email: string) {
  if (displayName) {
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className={className}>
      <path d='M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM19 19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V18H19V19Z' />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`relative text-sm font-medium transition-colors duration-200 group ${active ? 'text-white' : 'text-gray-400 hover:text-white'}`}>
      {label}
      <span className={`absolute -bottom-1 left-0 h-0.5 rounded-full bg-indigo-400 transition-all duration-300 ${active ? 'w-full' : 'w-0 group-hover:w-full'}`} />
    </Link>
  );
}

function UserAvatar({ profilePicture, displayName, email, isPremium, avatarAlt, premiumBadge }: { profilePicture: string | null; displayName: string | null; email: string; isPremium: boolean; avatarAlt: string; premiumBadge: string }) {
  return (
    <div className='relative'>
      {profilePicture ? <img src={profilePicture} alt={avatarAlt} className='w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/60' /> : <div className='w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-indigo-500/60'>{getInitials(displayName, email)}</div>}
      {isPremium && (
        <span className='absolute -top-1.5 -right-[0.175rem] leading-none select-none text-yellow-400' title={premiumBadge}>
          <CrownIcon className='w-3.5 h-3.5 drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]' />
        </span>
      )}
    </div>
  );
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { data: profile } = useUserProfile();
  const t = useTranslations('nav');

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const NAV_LINKS = [
    { label: t('home'), href: '/' },
    { label: t('leaderboard'), href: '/leaderboard' },
  ];

  const LOGGED_IN_NAV_LINKS = [
    { label: t('home'), href: '/' },
    { label: t('dashboard'), href: '/dashboard' },
    { label: t('leaderboard'), href: '/leaderboard' },
  ];

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    setMobileOpen(false);
    await logout();
    router.push('/');
  };

  const isLoggedIn = !authLoading && !!user;

  return (
    <>
      {/* ── Bar ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-gray-950/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20' : 'bg-transparent'}`}>
        <nav className='mx-auto max-w-7xl px-6 lg:px-8 h-16 flex items-center justify-between gap-6'>
          {/* ── Logo ── */}
          <Link href='/' className='flex items-center gap-2 group shrink-0'>
            <img src='/logo.png' alt={t('logoAlt')} className='w-8 h-8' />
            <span className='font-extrabold text-xl tracking-tight text-white group-hover:text-orange-100 transition-colors'>{t('brandName')}</span>
          </Link>

          {/* ── Center links (desktop) ── */}
          <div className='hidden md:flex items-center gap-8'>
            {(isLoggedIn ? LOGGED_IN_NAV_LINKS : NAV_LINKS).map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} />
            ))}
          </div>

          {/* ── Right side ── */}
          <div className='flex items-center gap-3 shrink-0'>
            {authLoading ? (
              // Skeleton loader
              <div className='w-24 h-8 rounded-full bg-white/10 animate-pulse' />
            ) : isLoggedIn ? (
              // ── Logged-in state ──
              <div className='flex items-center gap-4'>
                {/* Streak */}
                <div className='hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/25'>
                  <span className='text-base leading-none'>🔥</span>
                  <span className='text-sm font-bold text-orange-300'>{profile?.currentStreak ?? 0}</span>
                </div>

                {/* Score */}
                <div className='hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25'>
                  <span className='text-base leading-none'>⭐</span>
                  <span className='text-sm font-bold text-indigo-300'>{(profile?.cumulativeScore ?? 0).toLocaleString()}</span>
                </div>

                {/* Avatar + dropdown */}
                <div className='relative' ref={dropdownRef}>
                  <button id='user-avatar-btn' onClick={() => setDropdownOpen((o) => !o)} className='flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400' aria-label={t('userMenu')} aria-expanded={dropdownOpen}>
                    <UserAvatar profilePicture={profile?.profilePicture ?? null} displayName={profile?.displayName ?? null} email={user.email ?? ''} isPremium={profile?.subscriptionTier === 'PREMIUM' || profile?.subscriptionTier === 'PLUS'} avatarAlt={t('avatarAlt')} premiumBadge={t('premiumBadge')} />
                    <motion.svg animate={{ rotate: dropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className='w-4 h-4 text-gray-400 hidden sm:block' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
                    </motion.svg>
                  </button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div id='user-dropdown' variants={dropdownVariants} initial='hidden' animate='visible' exit='exit' className='absolute right-0 mt-3 w-56 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl shadow-black/40 overflow-hidden'>
                        {/* User info header */}
                        <div className='px-4 py-3 border-b border-white/10'>
                          <p className='text-sm font-semibold text-white truncate'>{profile?.displayName ?? profile?.username ?? user.email}</p>
                          <p className='text-xs text-gray-400 truncate mt-0.5'>{user.email}</p>
                          {/* Streak & score on mobile (also shown inside dropdown) */}
                          <div className='flex gap-3 mt-2 sm:hidden'>
                            <span className='text-xs text-orange-300'>
                              🔥 {profile?.currentStreak ?? 0} {t('streak')}
                            </span>
                            <span className='text-xs text-indigo-300'>⭐ {(profile?.cumulativeScore ?? 0).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Menu items */}
                        {[
                          { label: t('settings'), href: '/settings', icon: '⚙️' },
                          { label: t('subscription'), href: '/subscription', icon: <CrownIcon className='w-4 h-4 text-yellow-500' /> },
                        ].map((item) => (
                          <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)} className='flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'>
                            <span className='flex shrink-0'>{item.icon}</span>
                            {item.label}
                          </Link>
                        ))}

                        <div className='border-t border-white/10 mt-1'>
                          <button id='logout-btn' onClick={handleLogout} className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors'>
                            <span>🚪</span>
                            {t('logout')}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              // ── Logged-out state ──
              <div className='hidden md:flex items-center gap-3'>
                <Link href='/login' className='text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-full hover:bg-white/5'>
                  {t('login')}
                </Link>
                <Link href='/signup' className='text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 px-5 py-2 rounded-full shadow-[0_0_16px_rgba(99,102,241,0.35)] hover:shadow-[0_0_24px_rgba(99,102,241,0.55)] transition-all duration-200'>
                  {t('getStarted')}
                </Link>
              </div>
            )}

            {/* ── Hamburger (mobile) ── */}
            <button id='mobile-menu-btn' className='md:hidden flex flex-col gap-1.5 w-8 h-8 items-center justify-center rounded-lg hover:bg-white/10 transition-colors' onClick={() => setMobileOpen((o) => !o)} aria-label={t('toggleMobileMenu')} aria-expanded={mobileOpen}>
              <motion.span animate={mobileOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }} className='w-5 h-0.5 bg-white rounded-full block' />
              <motion.span animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }} className='w-5 h-0.5 bg-white rounded-full block' />
              <motion.span animate={mobileOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }} className='w-5 h-0.5 bg-white rounded-full block' />
            </button>
          </div>
        </nav>
      </header>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div variants={backdropVariants} initial='hidden' animate='visible' exit='exit' className='fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden' onClick={() => setMobileOpen(false)} aria-hidden='true' />

            {/* Slide-out panel */}
            <motion.aside variants={mobileMenuVariants} initial='hidden' animate='visible' exit='exit' className='fixed top-0 right-0 bottom-0 z-50 w-72 bg-gray-950 border-l border-white/10 shadow-2xl md:hidden flex flex-col'>
              {/* Header */}
              <div className='flex items-center justify-between px-6 h-16 border-b border-white/10'>
                <Link href='/' onClick={() => setMobileOpen(false)} className='flex items-center gap-2'>
                  <img src='/logo.svg' alt={t('logoAlt')} className='w-7 h-7' />
                  <span className='font-extrabold text-lg text-white'>{t('brandName')}</span>
                </Link>
                <button onClick={() => setMobileOpen(false)} className='w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors' aria-label={t('closeMenu')}>
                  ✕
                </button>
              </div>

              {/* Nav links */}
              <div className='flex-1 overflow-y-auto py-6 px-6 space-y-1'>
                {(isLoggedIn ? LOGGED_IN_NAV_LINKS : NAV_LINKS).map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${pathname === link.href ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                    {link.label}
                  </Link>
                ))}

                {/* Divider */}
                <div className='border-t border-white/10 my-4' />

                {isLoggedIn ? (
                  <>
                    {/* Stats */}
                    <div className='flex gap-3 px-4 py-3'>
                      <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/25'>
                        <span>🔥</span>
                        <span className='text-sm font-bold text-orange-300'>
                          {profile?.currentStreak ?? 0} {t('streak')}
                        </span>
                      </div>
                      <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25'>
                        <span>⭐</span>
                        <span className='text-sm font-bold text-indigo-300'>{(profile?.cumulativeScore ?? 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Profile items */}
                    {[
                      { label: t('settings'), href: '/settings', icon: '⚙️' },
                      { label: t('subscription'), href: '/subscription', icon: <CrownIcon className='w-5 h-5 text-yellow-500' /> },
                    ].map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className='flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors'>
                        <span className='flex shrink-0'>{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}

                    <button onClick={handleLogout} className='w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors'>
                      <span>🚪</span>
                      {t('logout')}
                    </button>
                  </>
                ) : (
                  <div className='flex flex-col gap-3 pt-2'>
                    <Link href='/login' onClick={() => setMobileOpen(false)} className='flex items-center justify-center px-4 py-3 rounded-xl text-sm font-medium text-gray-300 border border-white/15 hover:bg-white/5 hover:text-white transition-colors'>
                      {t('login')}
                    </Link>
                    <Link href='/signup' onClick={() => setMobileOpen(false)} className='flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 shadow-[0_0_16px_rgba(99,102,241,0.35)] transition-all'>
                      {t('getStarted')}
                    </Link>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Spacer so page content clears the fixed bar */}
      <div className='h-16' aria-hidden='true' />
    </>
  );
}
