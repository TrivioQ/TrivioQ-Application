'use client';

import { ColumnDef, Column } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { deleteUser } from '@/app/actions/user-actions';
import { SubscriptionTier } from '@trivioq/database';
import { useState, useTransition } from 'react';
import { UserModal } from './user-modal';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTranslations } from 'next-intl';

// Using a partial User type since we don't need everything
export type UserRow = {
  id: string;
  username: string;
  displayName?: string | null;
  email: string;
  dateOfBirth?: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt?: Date | null;
  currentStreak: number;
  activeWindowStart: Date;
  activeWindowEnd: Date;
  onDemandTokens: number;
};

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="h-3.5 w-3.5" />;
  if (sorted === 'desc') return <ArrowDown className="h-3.5 w-3.5" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
}

function SortableColumnHeader({ column, children }: { column: Column<UserRow, unknown>; children: React.ReactNode }) {
  return (
    <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
      {children} <SortIcon sorted={column.getIsSorted()} />
    </button>
  );
}

function UsernameHeader({ column }: { column: Column<UserRow, unknown> }) {
  const t = useTranslations('users');
  return <SortableColumnHeader column={column}>{t('columns.username')}</SortableColumnHeader>;
}

function EmailHeader({ column }: { column: Column<UserRow, unknown> }) {
  const t = useTranslations('users');
  return <SortableColumnHeader column={column}>{t('columns.email')}</SortableColumnHeader>;
}

function DateOfBirthHeader() {
  const t = useTranslations('users');
  return <>{t('columns.dateOfBirth')}</>;
}

function SubscriptionTierHeader({ column }: { column: Column<UserRow, unknown> }) {
  const t = useTranslations('users');
  return <SortableColumnHeader column={column}>{t('columns.subscriptionTier')}</SortableColumnHeader>;
}

function CurrentStreakHeader({ column }: { column: Column<UserRow, unknown> }) {
  const t = useTranslations('users');
  return <SortableColumnHeader column={column}>{t('columns.currentStreak')}</SortableColumnHeader>;
}

export const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: 'username',
    header: ({ column }) => <UsernameHeader column={column} />,
  },
  {
    accessorKey: 'email',
    header: ({ column }) => <EmailHeader column={column} />,
  },
  {
    accessorKey: 'dateOfBirth',
    header: () => <DateOfBirthHeader />,
    cell: ({ row }) => {
      const dob = row.getValue('dateOfBirth') as string | null | undefined;
      if (!dob) return <span className="text-gray-400">—</span>;
      return dob;
    },
  },
  {
    accessorKey: 'subscriptionTier',
    header: ({ column }) => <SubscriptionTierHeader column={column} />,
    cell: ({ row }) => {
      const tier = row.getValue('subscriptionTier') as string;
      return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tier === 'PREMIUM' ? 'bg-amber-100 text-amber-800' : tier === 'PLUS' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>{tier}</span>;
    },
  },
  {
    accessorKey: 'currentStreak',
    header: ({ column }) => <CurrentStreakHeader column={column} />,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;
      return <UserActions user={user} />;
    },
  },
];

function UserActions({ user }: { user: UserRow }) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('deleteConfirm.title', { username: user.username }),
      message: t('deleteConfirm.message'),
      confirmLabel: t('deleteConfirm.confirmLabel'),
      isDestructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteUser(user.id);
      if (!res.success) console.error(res.error);
    });
  };

  return (
    <>
      <UserModal user={user} open={editOpen} onOpenChange={setEditOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', className: 'h-8 w-8 p-0' })} disabled={isPending}>
          <span className="sr-only">{t('actions.openMenu')}</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{tc('actions')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> {t('actions.editUser')}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> {t('actions.deleteUser')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
