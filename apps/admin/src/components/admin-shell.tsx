'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, HelpCircle, Tags, LogOut, MessageSquareQuote, Settings, Trophy, ClockIcon, EyeIcon, Bell, Menu, X } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth-actions';
import { useTranslations } from 'next-intl';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('layout');
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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      {/* Tablet/mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={
          'fixed lg:relative z-30 lg:z-auto w-64 h-full bg-gray-900 text-white flex flex-col flex-shrink-0 ' +
          'transition-transform duration-200 ease-in-out ' +
          (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        }
        aria-label={t('sidebar.dashboard')}
      >
        <div className="p-6 text-2xl font-bold border-b border-gray-800 tracking-tight flex items-center justify-between">
          <span>
            {t('brand')} <span className="text-blue-500">{t('adminBadge')}</span>
          </span>
          <button
            type="button"
            onClick={closeSidebar}
            className="lg:hidden -mr-2 p-1 text-gray-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link onClick={closeSidebar} href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <LayoutDashboard size={20} className="text-gray-400" />
            <span>{t('sidebar.dashboard')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/users" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <Users size={20} className="text-gray-400" />
            <span>{t('sidebar.users')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/questions" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <HelpCircle size={20} className="text-gray-400" />
            <span>{t('sidebar.questions')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/questions/review" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <EyeIcon size={20} className="text-gray-400" />
            <span>{t('sidebar.reviewQuestions')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/categories" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <Tags size={20} className="text-gray-400" />
            <span>{t('sidebar.categories')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/faqs" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <MessageSquareQuote size={20} className="text-gray-400" />
            <span>{t('sidebar.faqs')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/notifications" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <Bell size={20} className="text-gray-400" />
            <span>{t('sidebar.notifications')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/bonus-plans" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <Trophy size={20} className="text-gray-400" />
            <span>{t('sidebar.bonusPlans')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/app-settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <Settings size={20} className="text-gray-400" />
            <span>{t('sidebar.appSettings')}</span>
          </Link>
          <Link onClick={closeSidebar} href="/subscription-history" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors font-medium">
            <ClockIcon size={20} className="text-gray-400" />
            <span>{t('sidebar.subscriptionHistory')}</span>
          </Link>
        </nav>

        {/* Logout Section */}
        <div className="p-4 border-t border-gray-800">
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-3 p-3 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-all font-medium group">
              <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
              <span>{t('sidebar.logout')}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:w-auto">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center px-4 h-14 border-b border-gray-200 bg-white shrink-0">
          <button
            type="button"
            onClick={toggleSidebar}
            className="-ml-2 p-2 text-gray-700 hover:text-gray-900"
            aria-label="Open sidebar"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 font-bold text-gray-900 text-base">
            {t('brand')} <span className="text-blue-500">{t('adminBadge')}</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-100/50">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
