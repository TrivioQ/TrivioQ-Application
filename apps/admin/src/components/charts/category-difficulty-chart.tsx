'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CategoryDifficultyBreakdown } from '@/app/actions/dashboard-actions';

const EASY_COLOR   = '#22c55e';
const MEDIUM_COLOR = '#f59e0b';
const HARD_COLOR   = '#ef4444';

// Minimum chart width so bars stay readable when many categories are present
const MIN_BAR_GROUP_WIDTH = 72; // px per category group

export function CategoryDifficultyChart({ data }: { data: CategoryDifficultyBreakdown[] }) {
  const chartWidth = Math.max(data.length * MIN_BAR_GROUP_WIDTH, 400);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: chartWidth }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, left: -8, bottom: 32 }}
            barCategoryGap="25%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              angle={-35}
              textAnchor="end"
              interval={0}
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
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
            <Bar dataKey="easy"   name="Easy"   fill={EASY_COLOR}   radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="medium" name="Medium" fill={MEDIUM_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="hard"   name="Hard"   fill={HARD_COLOR}   radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
