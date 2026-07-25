'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations, useLocale } from 'next-intl';
import { BRAND, AXIS, rgbaVar } from '@/lib/theme-tokens';

export interface ScorePeriod {
  periodStart: string;
  totalScore: number;
  bonusScore: number;
  baseScore: number;
  rank: number | null;
}

interface Props {
  data: ScorePeriod[];
  mode: 'weekly' | 'monthly';
  /** The i18n namespace to use for chart labels (e.g. 'dashboard'). */
  namespace?: string;
}

function formatLabel(dateStr: string, mode: 'weekly' | 'monthly', locale: string) {
  const d = new Date(dateStr);
  if (mode === 'monthly') {
    return d.toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const CustomTooltip = ({ active, payload, label, mode, t }: any) => {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const title = mode === 'monthly' ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : `${t('chart.weekOf')} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;

  return (
    <div className="bg-overlay border border-border dark:border-white/10 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-text-muted mb-2 font-medium">{title}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="font-semibold">
          {p.name}: {p.value.toLocaleString()} {t('chart.pts')}
        </p>
      ))}
    </div>
  );
};

export function ScoreTrendChart({ data, mode, namespace = 'dashboard' }: Props) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const sorted = [...data].sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());

  if (sorted.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-text-muted">{t('chart.noData')}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={sorted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={rgbaVar('--text-secondary', 0.2)} />
        <XAxis dataKey="periodStart" tick={{ fontSize: 10, fill: AXIS }} tickFormatter={(v) => formatLabel(v, mode, locale)} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: AXIS }} allowDecimals={false} width={44} />
        <Tooltip content={<CustomTooltip mode={mode} t={t} />} cursor={{ fill: rgbaVar('--text-secondary', 0.08) }} />
        <Bar dataKey="baseScore" name={t('chart.base')} stackId="a" fill={BRAND[600]} radius={[0, 0, 0, 0]} />
        <Bar dataKey="bonusScore" name={t('chart.bonus')} stackId="a" fill={BRAND[300]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
