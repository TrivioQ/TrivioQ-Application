'use client';

import { format } from 'date-fns';
import { Bell, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
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

const typeIcons: Record<string, string> = {
  TRIVIA_DROP: '📝',
  SYSTEM_ANNOUNCEMENT: '📢',
  SUBSCRIPTION_REMINDER: '⏰',
  OFFER_PROMOTION: '🎁',
  CREDIT_ALERT: '💎',
  ADMIN_MESSAGE: '💬',
};

export function NotificationCenterDropdown({ notifications, loading, onMarkAsRead, onMarkAllAsRead, onClose }: NotificationCenterDropdownProps) {
  const t = useTranslations('notifications.center');

  if (loading) {
    return (
      <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
        <div className="p-4 text-center text-gray-500">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{t('title')}</h3>
        <div className="flex items-center gap-2">
          <button onClick={onMarkAllAsRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            {t('markAllRead')}
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm">{t('noneYet')}</p>
          </div>
        ) : (
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id} className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.isRead ? 'bg-brand-50/50' : ''}`} onClick={() => onMarkAsRead(notification.id)}>
                <div className="flex items-start gap-3">
                  <span className="text-xl">{typeIcons[notification.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{notification.title}</p>
                      {!notification.isRead && <span className="h-2 w-2 bg-brand-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.body}</p>
                    <p className="text-xs text-gray-400 mt-2">{format(new Date(notification.createdAt), 'MMM d, HH:mm')}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <Link href="/dashboard/notifications" className="text-sm text-brand-600 hover:text-brand-700 font-medium text-center block">
          {t('viewAll')}
        </Link>
      </div>
    </div>
  );
}
