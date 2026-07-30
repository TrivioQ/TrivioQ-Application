'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SubscriptionTier } from '@trivioq/database';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TIERS: SubscriptionTier[] = ['FREE', 'PREMIUM'];

interface TierFilterProps {
  current?: SubscriptionTier;
  counts?: Record<string, number>;
}

export function TierFilter({ current, counts }: TierFilterProps) {
  const t = useTranslations('users.tierFilter');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setTier = (tier: SubscriptionTier | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1');
    if (tier) {
      params.set('tier', tier);
    } else {
      params.delete('tier');
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
      <button onClick={() => setTier(undefined)} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), !current && 'bg-muted font-semibold')}>
        {t('all')}
        {counts?.all !== undefined && (
          <span className={cn('ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors', !current ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-muted-foreground/20 text-muted-foreground')}>
            {counts.all}
          </span>
        )}
      </button>
      {TIERS.map((tier) => (
        <button key={tier} onClick={() => setTier(tier)} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), current === tier && 'bg-muted font-semibold')}>
          {tier === 'PREMIUM' ? t('premium') : t('free')}
          {counts?.[tier] !== undefined && (
            <span className={cn('ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors', current === tier ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-muted-foreground/20 text-muted-foreground')}>
              {counts[tier] ?? 0}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
