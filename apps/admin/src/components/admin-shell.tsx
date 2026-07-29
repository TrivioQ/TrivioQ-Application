'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  HelpCircle,
  Tags,
  LogOut,
  MessageSquareQuote,
  Settings,
  Trophy,
  ClockIcon,
  EyeIcon,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth-actions';
import { useTranslations } from 'next-intl';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { href: string; icon: React.ElementType; labelKey: string; exact?: boolean }[] = [
  { href: '/', icon: LayoutDashboard, labelKey: 'sidebar.dashboard', exact: true },
  { href: '/users', icon: Users, labelKey: 'sidebar.users' },
  { href: '/questions/review', icon: EyeIcon, labelKey: 'sidebar.reviewQuestions' },
  { href: '/questions', icon: HelpCircle, labelKey: 'sidebar.questions' },
  { href: '/categories', icon: Tags, labelKey: 'sidebar.categories' },
  { href: '/faqs', icon: MessageSquareQuote, labelKey: 'sidebar.faqs' },
  { href: '/notifications', icon: Bell, labelKey: 'sidebar.notifications' },
  { href: '/bonus-plans', icon: Trophy, labelKey: 'sidebar.bonusPlans' },
  { href: '/app-settings', icon: Settings, labelKey: 'sidebar.appSettings' },
  { href: '/subscription-history', icon: ClockIcon, labelKey: 'sidebar.subscriptionHistory' },
  { href: '/cron-jobs', icon: ClockIcon, labelKey: 'sidebar.cronJobs' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('layout');
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  // Close on Escape for accessibility / keyboard users
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, closeSidebar]);

  // Lock body scroll while overlay is open on tablet/mobile
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [sidebarOpen]);

  function isActive(href: string, exact?: boolean) {
    // Strip locale prefix (e.g. /en/users → /users)
    const stripped = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '') || '/';
    if (exact) return stripped === href;
    // For /questions, don't match /questions/review
    if (href === '/questions')
      return (
        stripped === '/questions' ||
        (stripped.startsWith('/questions') && !stripped.startsWith('/questions/review'))
      );
    return stripped === href || stripped.startsWith(`${href}/`);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-foreground">
      {/* Tablet/mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        id="admin-sidebar"
        className={cn(
          'fixed lg:relative z-30 lg:z-auto w-64 h-full flex flex-col flex-shrink-0',
          'bg-sidebar text-sidebar-foreground border-r border-sidebar-border',
          'transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label={t('sidebar.dashboard')}
      >
        {/* Logo / brand */}
        <div className="px-6 py-5 border-b border-sidebar-border flex items-center justify-between shrink-0">
          <Link href="/" onClick={closeSidebar} className="flex items-center gap-2.5 group">
            <Image src="/logo.png" alt="TrivioQ" width={28} height={28} className="w-7 h-7 shrink-0" />
            <span className="text-lg font-extrabold tracking-tight text-sidebar-foreground group-hover:text-sidebar-primary transition-colors">
              {t('brand')}{' '}
              <span className="text-brand-interactive">{t('adminBadge')}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="lg:hidden -mr-1 p-1.5 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-primary/10 text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    'shrink-0 transition-colors',
                    active ? 'text-sidebar-primary' : 'text-sidebar-foreground/50',
                  )}
                />
                <span>{t(labelKey as Parameters<typeof t>[0])}</span>
                {active && (
                  <span className="ml-auto w-1 h-4 rounded-full bg-sidebar-primary opacity-80" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — theme switcher + logout */}
        <div className="p-3 border-t border-sidebar-border shrink-0 space-y-1">
          {/* Theme switcher row */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg">
            <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Theme
            </span>
            <ThemeSwitcher />
          </div>

          {/* Logout */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors group"
            >
              <LogOut size={18} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
              <span>{t('sidebar.logout')}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:w-auto">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center px-4 h-14 border-b border-border bg-bg-secondary shrink-0">
          <button
            type="button"
            onClick={toggleSidebar}
            className="-ml-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open sidebar"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 font-extrabold text-base text-foreground">
            {t('brand')} <span className="text-brand-interactive">{t('adminBadge')}</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-bg">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
