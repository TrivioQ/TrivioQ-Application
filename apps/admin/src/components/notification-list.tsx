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
  TRIVIA_DROP: 'bg-blue-100 text-blue-800',
  SYSTEM_ANNOUNCEMENT: 'bg-purple-100 text-purple-800',
  SUBSCRIPTION_REMINDER: 'bg-amber-100 text-amber-800',
  OFFER_PROMOTION: 'bg-pink-100 text-pink-800',
  CREDIT_ALERT: 'bg-green-100 text-green-800',
  ADMIN_MESSAGE: 'bg-gray-100 text-gray-800',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  SENDING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
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
    const confirmed = await confirm(
      'Send Notification',
      'Are you sure you want to send this notification now?'
    );
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
    const confirmed = await confirm(
      'Delete Notification',
      'Are you sure you want to delete this notification? This cannot be undone.'
    );
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
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No notifications yet</h3>
        <p className="text-gray-500 mt-1">
          Create your first notification to get started
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead>Channels</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map((notification) => (
            <TableRow key={notification.id}>
              <TableCell>
                <Badge className={typeColors[notification.type] || 'bg-gray-100'}>
                  {notification.type.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell className="font-medium max-w-xs truncate">
                {notification.title}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {audienceLabels[notification.audience] || notification.audience}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {notification.channels.includes('PUSH_MOBILE') && (
                    <Smartphone className="h-4 w-4 text-gray-500" title="Mobile Push" />
                  )}
                  {notification.channels.includes('PUSH_WEB') && (
                    <Bell className="h-4 w-4 text-gray-500" title="Web Push" />
                  )}
                  {notification.channels.includes('EMAIL') && (
                    <Mail className="h-4 w-4 text-gray-500" title="Email" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                {notification.deliveredCount} / {notification.totalRecipients}
              </TableCell>
              <TableCell>
                <Badge className={statusColors[notification.status] || 'bg-gray-100'}>
                  {notification.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {format(new Date(notification.createdAt), 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <a href={`/notifications/${notification.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </a>
                    </DropdownMenuItem>
                    {notification.status === 'DRAFT' && (
                      <DropdownMenuItem onClick={() => handleSend(notification.id)}>
                        <Send className="h-4 w-4 mr-2" />
                        Send Now
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleDelete(notification.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
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