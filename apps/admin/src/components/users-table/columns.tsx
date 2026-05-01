'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteUser, toggleUserTier } from '@/app/actions/user-actions';
import { SubscriptionTier } from '@trivioq/database';
import { useState, useTransition } from 'react';
import { UserModal } from './user-modal';
import { useConfirm } from '@/components/ui/confirm-dialog';

// Using a partial User type since we don't need everything
export type UserRow = {
  id: string;
  username: string;
  displayName?: string | null;
  email: string;
  dateOfBirth?: Date | null;
  subscriptionTier: SubscriptionTier;
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

export const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: 'username',
    header: ({ column }) => (
      <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
        Username <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
        Email <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
  },
  {
    accessorKey: 'dateOfBirth',
    header: 'Date of Birth',
    cell: ({ row }) => {
      const dob = row.getValue('dateOfBirth') as Date | null | undefined;
      if (!dob) return <span className="text-gray-400">—</span>;
      return new Date(dob).toLocaleDateString('en-CA'); // YYYY-MM-DD
    },
  },
  {
    accessorKey: 'subscriptionTier',
    header: ({ column }) => (
      <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
        Subscription Tier <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => {
      const tier = row.getValue('subscriptionTier') as string;
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tier === 'PREMIUM' ? 'bg-amber-100 text-amber-800' : tier === 'PLUS' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
          {tier}
        </span>
      );
    },
  },
  {
    accessorKey: 'currentStreak',
    header: ({ column }) => (
      <button className="flex items-center gap-1 hover:text-gray-900" onClick={column.getToggleSortingHandler()}>
        Current Streak <SortIcon sorted={column.getIsSorted()} />
      </button>
    ),
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
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const confirm = useConfirm();

  const handleToggleTier = () => {
    startTransition(async () => {
      await toggleUserTier(user.id, user.subscriptionTier);
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${user.username}"?`,
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete User',
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
        <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0" })} disabled={isPending}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> Edit User
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleTier} disabled={isPending}>
              {user.subscriptionTier === 'FREE' ? 'Upgrade to Premium' : 'Downgrade to Free'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
              <Trash className="mr-2 h-4 w-4" /> Delete User
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
