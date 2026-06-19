'use client';

import { use } from 'react';
import { NotificationList } from '@/components/notification-list';
import { CreateNotificationDialog } from '@/components/create-notification-dialog';
import { Bell, Plus } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Bell className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              Manage and send notifications to users
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/notifications/templates`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Templates
          </Link>
          <CreateNotificationDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sent"
          value="--"
          description="All time notifications"
          color="purple"
        />
        <StatCard
          title="Delivered"
          value="--"
          description="Successfully delivered"
          color="green"
        />
        <StatCard
          title="Open Rate"
          value="--%"
          description="Average open rate"
          color="blue"
        />
        <StatCard
          title="Click Rate"
          value="--%"
          description="Average click rate"
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