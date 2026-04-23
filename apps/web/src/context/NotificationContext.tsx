'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = 'error' | 'success' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  /** Duration in ms before auto-dismiss. 0 = never auto-dismiss. Default: 5000 */
  duration?: number;
}

interface NotificationContextValue {
  notify: (opts: Omit<Notification, 'id'>) => void;
  dismiss: (id: string) => void;
  /** Shorthand helpers */
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  notifications: Notification[];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    ({ duration = 5000, ...rest }: Omit<Notification, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const notification: Notification = { id, duration, ...rest };

      setNotifications((prev) => [...prev, notification]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss],
  );

  const error = useCallback((message: string, title?: string) => notify({ type: 'error', message, title }), [notify]);
  const success = useCallback((message: string, title?: string) => notify({ type: 'success', message, title }), [notify]);
  const info = useCallback((message: string, title?: string) => notify({ type: 'info', message, title }), [notify]);
  const warning = useCallback((message: string, title?: string) => notify({ type: 'warning', message, title }), [notify]);

  return <NotificationContext.Provider value={{ notify, dismiss, error, success, info, warning, notifications }}>{children}</NotificationContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useNotification = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
};
