'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Notification, useNotification } from '../context/notification-context';

// ---------------------------------------------------------------------------
// Per-toast styles
// ---------------------------------------------------------------------------

const STYLES: Record<Notification['type'], { bar: string; icon: string; title: string; message: string; close: string }> = {
  error: {
    bar: 'border-red-500/60   bg-gray-900/95 shadow-[0_0_24px_rgba(239,68,68,0.15)]',
    icon: 'text-red-400',
    title: 'text-red-300',
    message: 'text-gray-300',
    close: 'text-red-400/60 hover:text-red-300',
  },
  success: {
    bar: 'border-emerald-500/60 bg-gray-900/95 shadow-[0_0_24px_rgba(16,185,129,0.15)]',
    icon: 'text-emerald-400',
    title: 'text-emerald-300',
    message: 'text-gray-300',
    close: 'text-emerald-400/60 hover:text-emerald-300',
  },
  warning: {
    bar: 'border-amber-500/60  bg-gray-900/95 shadow-[0_0_24px_rgba(245,158,11,0.15)]',
    icon: 'text-amber-400',
    title: 'text-amber-300',
    message: 'text-gray-300',
    close: 'text-amber-400/60 hover:text-amber-300',
  },
  info: {
    bar: 'border-sky-500/60    bg-gray-900/95 shadow-[0_0_24px_rgba(14,165,233,0.15)]',
    icon: 'text-sky-400',
    title: 'text-sky-300',
    message: 'text-gray-300',
    close: 'text-sky-400/60 hover:text-sky-300',
  },
};

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function NotificationIcon({ type }: { type: Notification['type'] }) {
  const cls = `${STYLES[type].icon} shrink-0 mt-0.5`;
  switch (type) {
    case 'error':
      return (
        <svg className={cls} width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='10' />
          <line x1='12' y1='8' x2='12' y2='12' />
          <line x1='12' y1='16' x2='12.01' y2='16' />
        </svg>
      );
    case 'success':
      return (
        <svg className={cls} width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />
          <polyline points='22 4 12 14.01 9 11.01' />
        </svg>
      );
    case 'warning':
      return (
        <svg className={cls} width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
          <line x1='12' y1='9' x2='12' y2='13' />
          <line x1='12' y1='17' x2='12.01' y2='17' />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className={cls} width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='10' />
          <line x1='12' y1='16' x2='12' y2='12' />
          <line x1='12' y1='8' x2='12.01' y2='8' />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Single Toast
// ---------------------------------------------------------------------------

function Toast({ notification }: { notification: Notification }) {
  const t = useTranslations('common');
  const { dismiss } = useNotification();
  const [visible, setVisible] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const s = STYLES[notification.type];

  // Slide in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Shrink progress bar over the duration
  useEffect(() => {
    if (!progressRef.current || !notification.duration) return;
    const el = progressRef.current;
    el.style.transition = `width ${notification.duration}ms linear`;
    el.style.width = '0%';
  }, [notification.duration]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => dismiss(notification.id), 300);
  };

  return (
    <div
      role='alert'
      aria-live='polite'
      className={`
        relative w-full max-w-sm overflow-hidden rounded-xl border backdrop-blur-sm
        transition-all duration-300 ease-out
        ${s.bar}
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      `}
    >
      <div className='flex items-start gap-3 px-4 py-3.5'>
        <NotificationIcon type={notification.type} />
        <div className='flex-1 min-w-0'>
          {notification.title && <p className={`text-sm font-semibold leading-snug ${s.title}`}>{notification.title}</p>}
          <p className={`text-sm leading-relaxed ${notification.title ? 'mt-0.5 text-gray-400' : s.message}`}>{notification.message}</p>
        </div>
        <button onClick={handleDismiss} aria-label={t('dismissNotification')} className={`shrink-0 transition-colors ${s.close}`}>
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'>
            <line x1='18' y1='6' x2='6' y2='18' />
            <line x1='6' y1='6' x2='18' y2='18' />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      {notification.duration && notification.duration > 0 && (
        <div className='h-0.5 bg-white/5'>
          <div ref={progressRef} className={`h-full ${notification.type === 'error' ? 'bg-red-500/50' : notification.type === 'success' ? 'bg-emerald-500/50' : notification.type === 'warning' ? 'bg-amber-500/50' : 'bg-sky-500/50'}`} style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toaster — mount once in the app layout via Providers
// ---------------------------------------------------------------------------

export function Toaster() {
  const { notifications } = useNotification();

  return (
    <div aria-label='Notifications' className='fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none'>
      {notifications.map((n) => (
        <div key={n.id} className='pointer-events-auto'>
          <Toast notification={n} />
        </div>
      ))}
    </div>
  );
}
