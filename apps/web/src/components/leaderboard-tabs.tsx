'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Flame } from 'lucide-react';

interface LeaderboardUser {
  id: string;
  username: string;
  displayName: string | null;
  cumulativeScore: number;
  currentStreak: number;
}

interface LeaderboardTabsProps {
  initialData: {
    global: {
      weekly: LeaderboardUser[];
      monthly: LeaderboardUser[];
      alltime: LeaderboardUser[];
    };
    friends: {
      weekly: LeaderboardUser[];
      monthly: LeaderboardUser[];
      alltime: LeaderboardUser[];
    };
  };
  isLoggedIn: boolean;
}

export function LeaderboardTabs({ initialData, isLoggedIn }: LeaderboardTabsProps) {
  const t = useTranslations('leaderboard');
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');
  const [activeMode, setActiveMode] = useState<'global' | 'friends'>('global');

  const tabs = [
    { id: 'weekly' as const, label: t('weekly') },
    { id: 'monthly' as const, label: t('monthly') },
    { id: 'alltime' as const, label: t('allTime') },
  ];

  const currentData = initialData[activeMode][activeTab];

  const getNextWeekReset = () => {
    const d = new Date();
    const day = d.getUTCDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const getNextMonthReset = () => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-6">
        {/* Global / Friends Toggle */}
        {isLoggedIn && (
          <div className="flex items-center p-1 bg-white/40 dark:bg-white/5 rounded-full border border-white dark:border-white/10 backdrop-blur-xl shadow-xl shadow-teal-900/10 dark:shadow-none">
            <button onClick={() => setActiveMode('global')} className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${activeMode === 'global' ? 'bg-blue-500 dark:bg-teal-500 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
              {t('global')}
            </button>
            <button onClick={() => setActiveMode('friends')} className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${activeMode === 'friends' ? 'bg-blue-500 dark:bg-teal-500 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
              {t('friends')}
            </button>
          </div>
        )}

        <div className="flex justify-center p-1 bg-white/40 dark:bg-gray-900/30 rounded-xl border border-white dark:border-white/5 backdrop-blur-xl w-fit mx-auto shadow-xl shadow-teal-900/10 dark:shadow-none">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === tab.id ? 'bg-blue-500 dark:bg-teal-500 text-white shadow-lg shadow-blue-500/30 dark:shadow-teal-500/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'alltime' && (
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600/90 dark:text-teal-400/80 bg-blue-500/10 dark:bg-teal-500/5 px-4 py-1.5 rounded-full border border-blue-500/20 dark:border-teal-500/10 backdrop-blur-sm">
            <span className="animate-pulse">●</span>
            {t('periodEnds', { date: activeTab === 'weekly' ? formatDate(getNextWeekReset()) : formatDate(getNextMonthReset()) })}
          </div>
        )}
      </div>

      {/* ── Leaderboard Table ── */}
      <div className="bg-white/30 dark:bg-gray-900/30 rounded-3xl border border-white dark:border-white/10 overflow-hidden backdrop-blur-2xl shadow-2xl shadow-teal-900/10 dark:shadow-black/40">
        {currentData.length === 0 ? (
          <div className="py-20 text-center text-gray-500 dark:text-gray-400">
            <span className="text-4xl block mb-4 opacity-70">🕸️</span>
            {t('noData')}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/30 dark:border-white/10 bg-white/10 dark:bg-white/5 backdrop-blur-xl">
                <th className="px-8 py-5 text-xs uppercase tracking-widest font-extrabold text-gray-600 dark:text-gray-400">{t('rankHeader')}</th>
                <th className="px-8 py-5 text-xs uppercase tracking-widest font-extrabold text-gray-600 dark:text-gray-400">{t('playerHeader')}</th>
                <th className="px-8 py-5 text-xs uppercase tracking-widest font-extrabold text-gray-600 dark:text-gray-400 text-right">{t('streakHeader')}</th>
                <th className="px-8 py-5 text-xs uppercase tracking-widest font-extrabold text-gray-600 dark:text-gray-400 text-right">{t('scoreHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40 dark:divide-white/5">
              {currentData.map((user, index) => (
                <tr key={user.id} className="group hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors">
                  <td className="px-8 py-6 font-mono text-xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="relative group/tooltip">
                        <span className="font-bold text-gray-900 dark:text-white text-lg cursor-help border-b border-dashed border-gray-400 dark:border-gray-600 hover:border-blue-500 dark:hover:border-teal-400 transition-colors">{user.displayName || user.username}</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-xs text-white dark:text-teal-300 rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none border border-gray-700 dark:border-teal-500/30 whitespace-nowrap z-50 shadow-xl">
                          @{user.username}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right font-bold text-orange-500 dark:text-orange-400 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Flame className="w-4 h-4 text-orange-500" />
                      {user.currentStreak}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-500 dark:from-white dark:to-gray-500">{user.cumulativeScore.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-center text-gray-500 text-sm">{t('scoresInfo')}</p>
    </div>
  );
}
