'use client';

import { useState } from 'react';

interface ScorePeriod {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string | null;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  rank: number | null;
}

interface ScoreHistoryTabsProps {
  weekly: ScorePeriod[];
  monthly: ScorePeriod[];
}

function formatPeriodLabel(period: ScorePeriod): string {
  const start = new Date(period.periodStart);
  if (period.periodType === 'WEEKLY') {
    const end = period.periodEnd ? new Date(period.periodEnd) : null;
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = end ? end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `${s} – ${e}`;
  }
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function RankBadge({ rank }: { rank: number | null }) {
  if (!rank) return <span className='text-gray-600 text-sm'>—</span>;
  const colors: Record<number, string> = {
    1: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    2: 'bg-gray-400/20 text-gray-300 border-gray-400/40',
    3: 'bg-amber-700/20 text-amber-400 border-amber-700/40',
  };
  const cls = colors[rank] ?? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span>;
}

function HistoryTable({ data }: { data: ScorePeriod[] }) {
  if (data.length === 0) {
    return (
      <div className='py-20 text-center text-gray-500'>
        <span className='text-5xl block mb-4'>📭</span>
        <p>No data yet. Answer some drops to build your history!</p>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-2xl border border-white/10'>
      <table className='w-full text-left'>
        <thead className='bg-white/5 text-xs uppercase tracking-widest text-gray-400'>
          <tr>
            <th className='px-6 py-4'>Period</th>
            <th className='px-6 py-4 text-right'>Trivia Score</th>
            <th className='px-6 py-4 text-right'>Bonus</th>
            <th className='px-6 py-4 text-right'>Total</th>
            <th className='px-6 py-4 text-right'>Rank</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-white/5'>
          {data.map((row) => (
            <tr key={row.id} className='hover:bg-white/[0.02] transition-colors'>
              <td className='px-6 py-4 text-sm text-gray-300 font-medium'>{formatPeriodLabel(row)}</td>
              <td className='px-6 py-4 text-right font-mono text-white'>{row.baseScore.toLocaleString()}</td>
              <td className='px-6 py-4 text-right'>{row.bonusScore > 0 ? <span className='text-green-400 font-bold font-mono'>+{row.bonusScore.toLocaleString()}</span> : <span className='text-gray-600 font-mono'>—</span>}</td>
              <td className='px-6 py-4 text-right'>
                <span className='text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300'>{row.totalScore.toLocaleString()}</span>
              </td>
              <td className='px-6 py-4 text-right'>
                <RankBadge rank={row.rank} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreHistoryTabs({ weekly, monthly }: ScoreHistoryTabsProps) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  return (
    <div className='space-y-6'>
      <div className='flex justify-center p-1 bg-gray-900/50 rounded-xl border border-white/5 backdrop-blur-sm w-fit mx-auto'>
        {(['weekly', 'monthly'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === tab ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {tab === 'weekly' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </div>

      <HistoryTable data={activeTab === 'weekly' ? weekly : monthly} />

      <p className='text-center text-gray-600 text-xs'>Showing up to 12 months of history. Bonus points are awarded at the end of each period.</p>
    </div>
  );
}
