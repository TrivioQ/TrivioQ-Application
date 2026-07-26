'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Bell, Mail, Smartphone, Send, Eye, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTranslations } from 'next-intl';

interface Notification {
  id: string;
  type: string;
  audience: string;
  title: string;
  status: string;
  channels: string[];
  totalRecipients: number;
  deliveredCount: number;
  createdAt: string;
}

const typeColors: Record<string, string> = {
  TRIVIA_DROP: 'bg-brand-100 text-brand-800',
  SYSTEM_ANNOUNCEMENT: 'bg-purple-100 text-purple-800',
  SUBSCRIPTION_REMINDER: 'bg-amber-100 text-amber-800',
  OFFER_PROMOTION: 'bg-pink-100 text-pink-800',
  CREDIT_ALERT: 'bg-green-100 text-green-800',
  ADMIN_MESSAGE: 'bg-muted text-muted-foreground',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-brand-100 text-brand-800',
  SENDING: 'bg-brand-100 text-brand-800',
  COMPLETED: 'bg-brand-100 text-brand-800',
  FAILED: 'bg-destructive/10 text-destructive',
};

const audienceLabels: Record<string, string> = {
  ALL_USERS: 'All Users',
  USER_SEGMENT: 'Segment',
  SPECIFIC_USERS: 'Specific',
};

export function NotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const t = useTranslations('notifications.list');

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/admin/notifications');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(id: string) {
    const confirmed = await confirm({
      title: t('sendConfirmTitle'),
      message: t('sendConfirmMsg')
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/notifications/${id}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send');
      await fetchNotifications();
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMsg')
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      await fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-background rounded-lg border border-border p-12 text-center">
        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground">{t('noneYet')}</h3>
        <p className="text-muted-foreground mt-1">
          {t('createPrompt')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-background rounded-lg border border-border">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.type')}</TableHead>
            <TableHead>{t('columns.title')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('columns.audience')}</TableHead>
            <TableHead>{t('columns.channels')}</TableHead>
            <TableHead>{t('columns.recipients')}</TableHead>
            <TableHead>{t('columns.status')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('columns.created')}</TableHead>
            <TableHead className="text-right">{t('columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map((notification) => (
            <TableRow key={notification.id}>
              <TableCell>
                <Badge className={`${typeColors[notification.type] || 'bg-muted'} whitespace-nowrap`}>
                  {notification.type.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell className="font-medium max-w-xs truncate">
                {notification.title}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Badge variant="outline">
                  {audienceLabels[notification.audience] || notification.audience}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {notification.channels.includes('PUSH_MOBILE') && (
                    <span title={t('channelTitles.mobilePush')}><Smartphone className="h-4 w-4 text-muted-foreground" /></span>
                  )}
                  {notification.channels.includes('PUSH_WEB') && (
                    <span title={t('channelTitles.webPush')}><Bell className="h-4 w-4 text-muted-foreground" /></span>
                  )}
                  {notification.channels.includes('EMAIL') && (
                    <span title={t('channelTitles.email')}><Mail className="h-4 w-4 text-muted-foreground" /></span>
                  )}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {notification.deliveredCount} / {notification.totalRecipients}
              </TableCell>
              <TableCell>
                <Badge className={`${statusColors[notification.status] || 'bg-muted'} whitespace-nowrap`}>
                  {notification.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                {format(new Date(notification.createdAt), 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem render={<a href={`/notifications/${notification.id}`} />}>
                      <Eye className="h-4 w-4 mr-2" />
                      {t('viewDetails')}
                    </DropdownMenuItem>
                    {notification.status === 'DRAFT' && (
                      <DropdownMenuItem onClick={() => handleSend(notification.id)}>
                        <Send className="h-4 w-4 mr-2" />
                        {t('sendNow')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleDelete(notification.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}