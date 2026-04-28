'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
}

function formatLabel(dateStr: string, mode: 'weekly' | 'monthly') {
  const d = new Date(dateStr);
  if (mode === 'monthly') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const CustomTooltip = ({ active, payload, label, mode }: any) => {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const title = mode === 'monthly'
    ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;

  return (
    <div className="bg-gray-800 border border-white/10 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2 font-medium">{title}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="font-semibold">
          {p.name}: {p.value.toLocaleString()} pts
        </p>
      ))}
    </div>
  );
};

export function ScoreTrendChart({ data, mode }: Props) {
  const sorted = [...data].sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());

  if (sorted.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-gray-500">
        No data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={sorted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="periodStart"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickFormatter={(v) => formatLabel(v, mode)}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} width={44} />
        <Tooltip content={<CustomTooltip mode={mode} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="baseScore" name="Base" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
        <Bar dataKey="bonusScore" name="Bonus" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
