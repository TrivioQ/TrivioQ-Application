'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { getUserFriendships, removeAdminFriendship } from '@/app/actions/friendship-actions';

interface FriendsTabProps {
  userId: string;
}

export function FriendsTab({ userId }: FriendsTabProps) {
  const [friendships, setFriendships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('users.friendsTab');
  const confirm = useConfirm();

  const fetchFriendships = useCallback(async () => {
    const result = await getUserFriendships(userId);
    if (result.success && result.data) {
      setFriendships(result.data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFriendships();
  }, [fetchFriendships]);

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: t('confirmRemoveTitle'),
      message: t('confirmRemove'),
      isDestructive: true,
    });
    if (!isConfirmed) return;
    
    setLoading(true);
    const result = await removeAdminFriendship(id);
    if (result.success) {
      fetchFriendships();
      toast.success(t('removeSuccess'));
    } else {
      setLoading(false);
      toast.error(t('removeFailed'));
    }
  };

  if (loading) {
    return <div>{t('loading')}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {friendships.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            {t('noFriendships')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('type')}</TableHead>
                <TableHead>{t('user')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('createdAt')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {friendships.map((f) => {
                const isRequester = f.requesterId === userId;
                const otherUser = isRequester ? f.addressee : f.requester;
                const connectionType = isRequester ? t('connectionOutgoing') : t('connectionIncoming');

                let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
                if (f.status === 'PENDING') variant = 'secondary';
                if (f.status === 'BLOCKED') variant = 'destructive';

                return (
                  <TableRow key={f.id}>
                    <TableCell>{connectionType}</TableCell>
                    <TableCell>
                      <div className="font-medium">{otherUser?.displayName || otherUser?.username}</div>
                      <div className="text-sm text-muted-foreground">{otherUser?.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant}>{f.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(f.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
