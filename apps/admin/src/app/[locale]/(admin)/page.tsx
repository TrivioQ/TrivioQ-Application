import { getTranslations } from 'next-intl/server';
import { getDashboardMetrics, getDailyActiveUsers, getCategoryPopularity } from '@/app/actions/dashboard-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Zap, Star, Target } from 'lucide-react';
import { DailyActiveUsersChart } from '@/components/charts/daily-active-users-chart';
import { CategoryPopularityChart } from '@/components/charts/category-popularity-chart';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  // Fetch all data concurrently
  const [metrics, dauData, categoryData] = await Promise.all([getDashboardMetrics(), getDailyActiveUsers(), getCategoryPopularity()]);

  const cards = [
    {
      id: 'total-users',
      title: t('metrics.totalUsers'),
      icon: Users,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      value: metrics.totalUsers.toLocaleString(),
      description: t('metrics.newUsersMonth', { count: metrics.newUsersThisMonth }),
      badge: {
        label: `+${metrics.userGrowthPct}%`,
        positive: metrics.userGrowthPct >= 0,
      },
    },
    {
      id: 'active-drops',
      title: t('metrics.activeDrops'),
      icon: Zap,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      value: metrics.activeDropsToday.toLocaleString(),
      description: t('metrics.activeDropsDesc'),
      badge: null,
    },
    {
      id: 'premium-conversion',
      title: t('metrics.premiumConversion'),
      icon: Star,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-100',
      value: `${metrics.premiumConversionRate}%`,
      description: t('metrics.premiumDesc', { premium: metrics.premiumUsers, total: metrics.totalUsers }),
      badge: null,
    },
    {
      id: 'global-accuracy',
      title: t('metrics.globalAccuracy'),
      icon: Target,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      value: `${metrics.globalAccuracy}%`,
      description: t('metrics.accuracyDesc', { correct: metrics.correctDrops.toLocaleString(), total: metrics.totalAnsweredDrops.toLocaleString() }),
      badge: null,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-2">{t('overview')}</p>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.id} className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${card.iconBg}`}>
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  {card.badge && <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${card.badge.positive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{card.badge.label}</span>}
                </div>
                <CardTitle className="mt-3 text-sm font-medium text-gray-600">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-3xl font-bold text-gray-900 tracking-tight">{card.value}</div>
                <CardDescription className="mt-1 text-xs">{card.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily Active Users */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">{t('dau.title')}</CardTitle>
            <CardDescription>{t('dau.description')}</CardDescription>
          </CardHeader>
          <CardContent>{dauData.length === 0 ? <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">{t('dau.empty')}</div> : <DailyActiveUsersChart data={dauData} />}</CardContent>
        </Card>

        {/* Category Popularity */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">{t('categories.title')}</CardTitle>
            <CardDescription>{t('categories.description')}</CardDescription>
          </CardHeader>
          <CardContent>{categoryData.length === 0 ? <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">{t('categories.empty')}</div> : <CategoryPopularityChart data={categoryData} />}</CardContent>
        </Card>
      </div>
    </div>
  );
}
