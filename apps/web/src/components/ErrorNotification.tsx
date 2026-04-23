'use client';

import { useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';

interface ErrorNotificationProps {
  message: string;
  title?: string;
}

/**
 * Renders nothing visually — purely triggers a toast notification on mount.
 *
 * Use this to surface errors from Server Components, which cannot call hooks
 * directly. Pass this component conditionally from the server component when
 * a data-fetch failure occurs.
 *
 * @example
 * // Server Component
 * {fetchFailed && <ErrorNotification title="Failed to load" message={errorMessage} />}
 */
export function ErrorNotification({ message, title }: ErrorNotificationProps) {
  const { error } = useNotification();

  useEffect(() => {
    error(message, title);
  }, []);

  return null;
}
