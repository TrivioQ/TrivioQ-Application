'use client';

import { useTableParams } from '@/hooks/use-table-params';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
] as const;

export function FaqStatusFilter({ current }: { current?: boolean }) {
  const { pushParams } = useTableParams();

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
