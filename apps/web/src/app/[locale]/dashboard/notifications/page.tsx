'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bell, Check, Mail, Wifi } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  pushDelivered: boolean;
  emailDelivered: boolean;
  readAt?: string;
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  TRIVIA_DROP: '📝',
  SYSTEM_ANNOUNCEMENT: '📢',
  SUBSCRIPTION_REMINDER: '⏰',
  OFFER_PROMOTION: '🎁',
  CREDIT_ALERT: '💎',
  ADMIN_MESSAGE: '💬',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const t = useTranslations('notifications');

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/notifications?limit=100');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  const filteredNotifications = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Bell className="h-12 w-12 text-text-muted/70 mx-auto mb-4 animate-pulse" />
          <p className="text-text-muted">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text">{t('pageTitle')}</h1>
            <p className="text-text-muted mt-1">{unreadCount > 0 ? t('youHaveUnread', { count: unreadCount, plural: unreadCount > 1 ? 's' : '' }) : t('allCaughtUp')}</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-border bg-bg-secondary px-3 py-1.5 text-text hover:bg-bg disabled:opacity-50 disabled:pointer-events-none">
              <Check className="h-4 w-4 mr-2" />
              {t('markAllRead')}
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-brand-100 text-brand-700' : 'text-text-muted hover:bg-bg'}`}>
            {t('all')} ({notifications.length})
          </button>
          <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-brand-100 text-brand-700' : 'text-text-muted hover:bg-bg'}`}>
            {t('unread')} ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-bg-secondary rounded-lg border border-border p-12 text-center">
              <Bell className="h-16 w-16 text-text-muted/70 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text">{filter === 'unread' ? t('noUnread') : t('noNotifications')}</h3>
              <p className="text-text-muted mt-1">{filter === 'unread' ? t('allReadMessage') : t('noneYetMessage')}</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div key={notification.id} onClick={() => handleMarkAsRead(notification.id)} className={`bg-bg-secondary rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${!notification.isRead ? 'border-brand-200 bg-brand-50/30 dark:bg-brand-500/10' : 'border-border'}`}>
                <div className="flex items-start gap-4">
                  <span className="text-2xl">{typeIcons[notification.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text">{notification.title}</h3>
                      {!notification.isRead && <span className="h-2 w-2 bg-brand-500 rounded-full" />}
                    </div>
                    <p className="text-text-muted mt-1">{notification.body}</p>

                    {/* Delivery indicators */}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-text-muted/80">{format(new Date(notification.createdAt), 'MMM d, yyyy HH:mm')}</span>
                      <div className="flex items-center gap-2">
                        {notification.pushDelivered && (
                          <div className="flex items-center gap-1 text-xs text-text-muted/80" title={t('pushDelivered')}>
                            <Wifi className="h-3 w-3" />
                          </div>
                        )}
                        {notification.emailDelivered && (
                          <div className="flex items-center gap-1 text-xs text-text-muted/80" title={t('emailDelivered')}>
                            <Mail className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>

                    {notification.readAt && <p className="text-xs text-text-muted/80 mt-2">{t('readAt', { date: format(new Date(notification.readAt), 'MMM d, HH:mm') })}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
