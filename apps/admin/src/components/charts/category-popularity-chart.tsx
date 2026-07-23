'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { CategoryPopularity } from '@/app/actions/dashboard-actions';

// Indigo → purple gradient across bars
const BAR_COLORS = ['#6366f1', '#7c3aed', '#8b5cf6', '#a78bfa', '#818cf8', '#4f46e5', '#c4b5fd', '#a5b4fc', '#ddd6fe', '#e0e7ff'];

import { useTranslations } from 'next-intl';

export function CategoryPopularityChart({ data }: { data: CategoryPopularity[] }) {
  const t = useTranslations('dashboard.questionsExplorer');

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} width={40} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(value) => [value, t('questionsUnit')]} cursor={{ fill: '#f5f3ff' }} />
        <Bar dataKey="questions" radius={[4, 4, 0, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
