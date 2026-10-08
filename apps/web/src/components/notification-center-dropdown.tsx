'use client';

import { format } from 'date-fns';
import { Bell, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { notificationHref, notificationTypeIcons } from '@/lib/notification-routing';

interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterDropdownProps {
  notifications: UserNotification[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function NotificationCenterDropdown({ notifications, loading, onMarkAsRead, onMarkAllAsRead, onClose }: NotificationCenterDropdownProps) {
  const t = useTranslations('notifications.center');
  const router = useRouter();

  const open = (n: UserNotification) => {
    if (!n.isRead) onMarkAsRead(n.id);
    const href = notificationHref(n.data);
    if (href) {
      onClose();
      router.push(href);
    }
  };

  if (loading) {
    return (
      <div className="absolute right-0 mt-2 w-96 bg-bg-secondary rounded-lg shadow-xl border border-border z-20 overflow-hidden">
        <div className="p-4 text-center text-text-muted">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 mt-2 w-96 bg-bg-secondary rounded-lg shadow-xl border border-border z-20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-text">{t('title')}</h3>
        <div className="flex items-center gap-2">
          <button onClick={onMarkAllAsRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            {t('markAllRead')}
          </button>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <Bell className="h-12 w-12 text-text-muted/60 mx-auto mb-3" />
            <p className="text-sm">{t('noneYet')}</p>
          </div>
        ) : (
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id} className={`border-b border-border transition-colors ${!notification.isRead ? 'bg-brand-50/50' : ''}`}>
                <button type="button" onClick={() => open(notification)} className="w-full text-left p-4 hover:bg-bg flex items-start gap-3">
                  <span className="text-xl" aria-hidden="true">
                    {notificationTypeIcons[notification.type] || '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text truncate">{notification.title}</p>
                      {!notification.isRead && <span className="h-2 w-2 bg-brand-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-text-muted mt-1 line-clamp-2">{notification.body}</p>
                    <p className="text-xs text-text-muted/80 mt-2">{format(new Date(notification.createdAt), 'MMM d, HH:mm')}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-bg">
        <Link href="/dashboard/notifications" className="text-sm text-brand-600 hover:text-brand-700 font-medium text-center block">
          {t('viewAll')}
        </Link>
      </div>
    </div>
  );
}
