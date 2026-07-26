'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SubscriptionTier } from '@trivioq/database';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TIERS: SubscriptionTier[] = ['FREE', 'PREMIUM'];

export function TierFilter({ current }: { current?: SubscriptionTier }) {
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
      </button>
      {TIERS.map((tier) => (
        <button key={tier} onClick={() => setTier(tier)} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), current === tier && 'bg-muted font-semibold')}>
          {tier === 'PREMIUM' ? t('premium') : t('free')}
        </button>
      ))}
    </div>
  );
}
