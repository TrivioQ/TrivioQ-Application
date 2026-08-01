import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getUserStats } from '@/app/actions/user-stats-actions';
import { getTranslations } from 'next-intl/server';
import { UserStatsClient } from './user-stats-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default async function UserStatsPage({ params }: { params: Promise<{ username: string; locale: string }> }) {
  const p = await params;
  const username = decodeURIComponent(p.username);
  const t = await getTranslations('users');

  const result = await getUserStats(username);

  if (!result.success || !result.data) {
    notFound();
  }

  const { user, weeklyScore, monthlyScore, competitionsWon, accuracyByCategory } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/users" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-3 mb-2' })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {t('title')}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">User Overview</h1>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <UserStatsClient
          user={user as any}
          weeklyScore={weeklyScore as any}
          monthlyScore={monthlyScore as any}
          competitionsWon={competitionsWon as number}
          accuracyByCategory={accuracyByCategory as any}
        />
      </Suspense>
    </div>
  );
}
