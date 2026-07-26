'use client';

import { use } from 'react';
import { NotificationList } from '@/components/notification-list';
import { CreateNotificationDialog } from '@/components/create-notification-dialog';
import { Bell } from 'lucide-react';
import Link from 'next/link';

import { useTranslations } from 'next-intl';

export default function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations('notifications');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Bell className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('pageDescription')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/${locale}/notifications/templates`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('templatesButton')}
          </Link>
          <CreateNotificationDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('stats.totalSent')}
          value="--"
          description={t('stats.allTimeNotifications')}
          color="purple"
        />
        <StatCard
          title={t('stats.delivered')}
          value="--"
          description={t('stats.successfullyDelivered')}
          color="green"
        />
        <StatCard
          title={t('stats.openRate')}
          value="--%"
          description={t('stats.averageOpenRate')}
          color="blue"
        />
        <StatCard
          title={t('stats.clickRate')}
          value="--%"
          description={t('stats.averageClickRate')}
          color="amber"
        />
      </div>

      {/* Notification List */}
      <NotificationList />
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  color,
}: {
  title: string;
  value: string;
  description: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Bell className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}