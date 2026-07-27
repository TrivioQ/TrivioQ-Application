'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { makeAPICallV1 } from '@/lib/api';
import { MultiCategoryCombobox, type CategoryOption } from '@/components/multi-category-combobox';

interface CategoriesStepProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  initialNames: string[];
}

interface CategoriesResponse {
  categories: CategoryOption[];
}

export function CategoriesStep({ selected, onChange, initialNames }: CategoriesStepProps) {
  const t = useTranslations('getStarted');
  const [ready, setReady] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: () => makeAPICallV1<CategoriesResponse>('categories/list'),
    staleTime: 60_000 * 60,
  });

  // Default to all-selected on first mount of options.
  useEffect(() => {
    if (ready) return;
    const list = data?.categories ?? [];
    if (list.length === 0) return;
    onChange(initialNames.length > 0 ? initialNames : list.map((c) => c.name));
    setReady(true);
  }, [data, initialNames, onChange, ready]);

  const count = selected.length;
  const meetsMinimum = count >= 30;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-text">{t('step1Title')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('step1Desc')}</p>
      </div>

      {isLoading && <p className="text-text-muted text-sm">Loading categories…</p>}
      {error && <p className="text-error text-sm">Could not load categories. Refresh and try again.</p>}

      {data && (
        <>
          <div className="flex items-center justify-between text-xs uppercase tracking-wider">
            <span className={`font-bold ${meetsMinimum ? 'text-success' : 'text-text-muted'}`}>{t('selectedLabel', { count })}</span>
            {!meetsMinimum && <span className="text-warning font-bold">{t('step1MinError')}</span>}
          </div>
          <MultiCategoryCombobox options={data.categories} selectedNames={selected} onChange={onChange} />
        </>
      )}
    </div>
  );
}
