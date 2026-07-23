'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTableParams } from '@/hooks/use-table-params';
import { useTranslations } from 'next-intl';

export function UsageFilter({ current }: { current?: string }) {
  const t = useTranslations('categories.usageFilter');
  const { pushParams, isPending } = useTableParams();
  return (
    <Select value={current || 'all'} onValueChange={(val) => pushParams({ hasQuestions: val === 'all' ? null : val, page: '1' })} disabled={isPending}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={t('placeholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('all')}</SelectItem>
        <SelectItem value="true">{t('inUse')}</SelectItem>
        <SelectItem value="false">{t('unused')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
