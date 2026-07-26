'use client';

import { AppSelect } from '@/components/ui/app-select';
import { useTableParams } from '@/hooks/use-table-params';
import { useTranslations } from 'next-intl';

export function UsageFilter({ current }: { current?: string }) {
  const t = useTranslations('categories.usageFilter');
  const { pushParams, isPending } = useTableParams();
  return (
    <AppSelect
      value={current || 'all'}
      onValueChange={(val) => pushParams({ hasQuestions: val === 'all' ? null : (val as string), page: '1' })}
      disabled={isPending}
      className="w-40"
      placeholder={t('placeholder')}
      options={[
        { value: 'all', label: t('all') },
        { value: 'true', label: t('inUse') },
        { value: 'false', label: t('unused') },
      ]}
    />
  );
}
