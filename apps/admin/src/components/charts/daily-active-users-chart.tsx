'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DailyActiveUser } from '@/app/actions/dashboard.actions';

export function DailyActiveUsersChart({ data }: { data: DailyActiveUser[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={(v: string) => {
            const d = new Date(v + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          labelFormatter={(label) => {
            const d = new Date(String(label) + 'T00:00:00');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          }}
          formatter={(value) => [value, 'Active Users']}
        />
        <Line
          type="monotone"
          dataKey="users"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, fill: '#6366f1' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
