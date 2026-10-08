'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CATEGORY_BUNDLES, MIN_CATEGORIES, categoriesInBundle, pickBalancedCategories } from '@trivioq/shared-types';

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface MultiCategoryComboboxProps {
  options: CategoryOption[];
  selectedNames: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

/**
 * Multi-select category picker. Self-contained — no external UI primitives.
 * Selection state is hoisted to the parent via the `selectedNames` array.
 */
export function MultiCategoryCombobox({ options, selectedNames, onChange, placeholder }: MultiCategoryComboboxProps) {
  const t = useTranslations('common.categoryCombobox');
  const [query, setQuery] = useState('');

  const effectivePlaceholder = placeholder ?? t('searchPlaceholder');

  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.name.toLowerCase().includes(q));
  }, [options, query]);

  const allChecked = selectedSet.size === options.length && options.length > 0;

  const bundles = useMemo(() => CATEGORY_BUNDLES.map((b) => ({ ...b, names: categoriesInBundle(b, options) })).filter((b) => b.names.length > 0), [options]);

  function toggleBundle(names: string[]) {
    const allIn = names.every((n) => selectedSet.has(n));
    const next = new Set(selectedSet);
    names.forEach((n) => (allIn ? next.delete(n) : next.add(n)));
    onChange(Array.from(next));
  }

  function toggle(name: string) {
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(Array.from(next));
  }

  function toggleAll() {
    if (allChecked) onChange([]);
    else onChange(options.map((c) => c.name));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="text" aria-label={effectivePlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={effectivePlaceholder} className="flex-1 bg-bg-secondary dark:bg-bg-secondary-dark border border-border rounded-xl px-4 py-2 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button type="button" onClick={() => onChange(pickBalancedCategories(options, MIN_CATEGORIES))} disabled={options.length === 0} className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-brand-500/10 border border-brand-500/30 text-brand-600 dark:text-brand-300 hover:bg-brand-500/20 transition-colors disabled:opacity-50">
          ✨ {t('pickForMe')}
        </button>
        <button type="button" onClick={toggleAll} disabled={options.length === 0} className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-bg-secondary dark:bg-bg-secondary-dark border border-border text-text hover:bg-overlay transition-colors disabled:opacity-50">
          {allChecked ? t('clearAll') : t('selectAll')}
        </button>
      </div>

      {bundles.length > 0 && (
        <div role="group" aria-label={t('bundles')} className="flex flex-wrap gap-2">
          {bundles.map((b) => {
            const allIn = b.names.every((n) => selectedSet.has(n));
            return (
              <button key={b.id} type="button" aria-pressed={allIn} onClick={() => toggleBundle(b.names)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${allIn ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-300' : 'border-border text-text-muted hover:text-text'}`}>
                {b.emoji} {t(`bundle.${b.id}`)} ({b.names.length})
              </button>
            );
          })}
        </div>
      )}

      <div className="max-h-96 overflow-y-auto rounded-2xl border border-border bg-bg-secondary/40 p-3">
        <ul className="space-y-1">
          {filtered.map((c) => {
            const isSelected = selectedSet.has(c.name);
            return (
              <li key={c.id}>
                <label className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-overlay/50 transition-colors">
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(c.name)} className="h-4 w-4 shrink-0 rounded border-border bg-bg-secondary text-brand-600 dark:text-brand-500 accent-brand-600 dark:accent-brand-500 focus:ring-brand-600 dark:focus:ring-brand-500 cursor-pointer" />
                  <span className="text-text truncate">{c.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 && <p className="text-center text-text-muted text-sm py-6">{t('noMatch')}</p>}
      </div>
    </div>
  );
}
