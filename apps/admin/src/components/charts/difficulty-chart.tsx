'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { DifficultyBreakdown } from '@/app/actions/dashboard-actions';

import { useTranslations } from 'next-intl';

const DIFFICULTY_CONFIG = {
  EASY:   { key: 'easy',   color: '#22c55e' },
  MEDIUM: { key: 'medium', color: '#f59e0b' },
  HARD:   { key: 'hard',   color: '#ef4444' },
} as const;

export function DifficultyChart({ data }: { data: DifficultyBreakdown[] }) {
  const tq = useTranslations('questions.createModal');
  const t = useTranslations('dashboard.questionsExplorer');

  const chartData = data.map((d) => ({
    name: tq(DIFFICULTY_CONFIG[d.level].key as any),
    count: d.count,
    color: DIFFICULTY_CONFIG[d.level].color,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 20, right: 24, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 13, fill: '#374151', fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
          formatter={(value) => [value, t('questionsUnit')]}
          cursor={{ fill: '#f9fafb' }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={80}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
          <LabelList
            dataKey="count"
            position="top"
            style={{ fontSize: 13, fontWeight: 700, fill: '#374151' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
