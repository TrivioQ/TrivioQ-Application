'use client';

import { useTableParams } from '@/hooks/use-table-params';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export function FaqStatusFilter({ current }: { current?: boolean }) {
  const t = useTranslations('faqs.statusFilter');
  const { pushParams } = useTableParams();

  const OPTIONS = [
    { label: t('all'), value: undefined },
    { label: t('active'), value: true },
    { label: t('inactive'), value: false },
  ] as const;

  const set = (val: boolean | undefined) =>
    pushParams({ active: val === undefined ? null : String(val), page: '1' });

  return (
    <div className="flex items-center gap-1 rounded-md border bg-white p-1">
      {OPTIONS.map(({ label, value }) => (
        <Button
          key={label}
          variant="ghost"
          size="sm"
          onClick={() => set(value)}
          className={cn(current === value && 'bg-gray-100 font-semibold')}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
