'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toggleUserTier } from '@/app/actions/user.actions';
import { SubscriptionTier } from '@trivioq/database';
import { useTransition } from 'react';

// Using a partial User type since we don't need everything
export type UserRow = {
  id: string;
  username: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  currentStreak: number;
};

export const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: 'username',
    header: 'Username',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'subscriptionTier',
    header: 'Subscription Tier',
    cell: ({ row }) => {
      const tier = row.getValue('subscriptionTier') as string;
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tier === 'PREMIUM' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
          {tier}
        </span>
      );
    },
  },
  {
    accessorKey: 'currentStreak',
    header: 'Current Streak',
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

  const handleToggleTier = () => {
    startTransition(async () => {
      await toggleUserTier(user.id, user.subscriptionTier);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0" })} disabled={isPending}>
        <span className="sr-only">Open menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleToggleTier} disabled={isPending}>
          {user.subscriptionTier === 'FREE' ? 'Upgrade to Premium' : 'Downgrade to Free'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
