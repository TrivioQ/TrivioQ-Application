'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Mail, Smartphone, Users, CheckCircle, Eye, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Notification {
  id: string;
  type: string;
  audience: string;
  title: string;
  body: string;
  status: string;
  channels: string[];
  totalRecipients: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  createdAt: string;
  sentAt?: string;
}

export default function NotificationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(params);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const [notifRes, analyticsRes] = await Promise.all([
          fetch(`/api/admin/notifications/${id}`),
          fetch(`/api/admin/notifications/${id}/analytics`),
        ]);
        if (!notifRes.ok || !analyticsRes.ok) throw new Error('Failed to fetch');
        const notifData = await notifRes.json();
        const analyticsData = await analyticsRes.json();
        setNotification(notifData.notification);
        setAnalytics(analyticsData.analytics);
      } catch (error) {
        console.error('Error fetching notification:', error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading notification details...
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Notification not found</h2>
        <Link href={`/${locale}/notifications`} className="text-purple-600 hover:underline mt-2 inline-block">
          ← Back to Notifications
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={`/${locale}/notifications`}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Notifications
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Bell className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{notification.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getTypeColor(notification.type)}>
                {notification.type.replace(/_/g, ' ')}
              </Badge>
              <Badge className={getStatusColor(notification.status)}>
                {notification.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnalyticsCard
            title="Total Recipients"
            value={analytics.totalRecipients.toLocaleString()}
            icon={Users}
            color="blue"
          />
          <AnalyticsCard
            title="Delivered"
            value={analytics.deliveredCount.toLocaleString()}
            description={`${analytics.deliveryRate.toFixed(1)}% delivery rate`}
            icon={CheckCircle}
            color="green"
          />
          <AnalyticsCard
            title="Opened"
            value={analytics.readCount.toLocaleString()}
            description={`${analytics.readRate.toFixed(1)}% open rate`}
            icon={Eye}
            color="purple"
          />
          <AnalyticsCard
            title="Clicked"
            value={analytics.clickedCount.toLocaleString()}
            description={`${analytics.clickRate.toFixed(1)}% click rate`}
            icon={TrendingUp}
            color="amber"
          />
        </div>
      )}

      {/* Content Card */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Title</label>
            <p className="mt-1 text-gray-900">{notification.title}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Message</label>
            <p className="mt-1 text-gray-900 whitespace-pre-wrap">{notification.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Audience</label>
              <p className="mt-1">{notification.audience.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Channels</label>
              <div className="flex gap-2 mt-1">
                {notification.channels.map((channel) => (
                  <Badge key={channel} variant="outline">
                    {getChannelIcon(channel)} {channel.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Created</label>
              <p className="mt-1">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </div>
            {notification.sentAt && (
              <div>
                <label className="text-sm font-medium text-gray-700">Sent At</label>
                <p className="mt-1">
                  {new Date(notification.sentAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Delivered</span>
              <span className="font-medium">
                {notification.deliveredCount} / {notification.totalRecipients}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(notification.deliveredCount / notification.totalRecipients) * 100}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  description?: string;
  icon: any;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    TRIVIA_DROP: 'bg-blue-100 text-blue-800',
    SYSTEM_ANNOUNCEMENT: 'bg-purple-100 text-purple-800',
    SUBSCRIPTION_REMINDER: 'bg-amber-100 text-amber-800',
    OFFER_PROMOTION: 'bg-pink-100 text-pink-800',
    CREDIT_ALERT: 'bg-green-100 text-green-800',
    ADMIN_MESSAGE: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || 'bg-gray-100';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    SENDING: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100';
}

function getChannelIcon(channel: string): string {
  switch (channel) {
    case 'PUSH_MOBILE':
      return '📱';
    case 'PUSH_WEB':
      return '🔔';
    case 'EMAIL':
      return '📧';
    default:
      return '';
  }
}