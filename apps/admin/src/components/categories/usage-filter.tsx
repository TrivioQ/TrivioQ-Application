'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTableParams } from '@/hooks/use-table-params';

export function UsageFilter({ current }: { current?: string }) {
  const { pushParams, isPending } = useTableParams();
  return (
    <Select value={current || 'all'} onValueChange={(val) => pushParams({ hasQuestions: val === 'all' ? null : val, page: '1' })} disabled={isPending}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Usage" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Categories</SelectItem>
        <SelectItem value="true">In Use</SelectItem>
        <SelectItem value="false">Unused</SelectItem>
      </SelectContent>
    </Select>
  );
}
