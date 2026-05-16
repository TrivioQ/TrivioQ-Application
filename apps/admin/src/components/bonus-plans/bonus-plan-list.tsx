'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTranslations } from 'next-intl';
import { type BonusPlanInitialValues } from './bonus-plan-form';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BonusPlan {
  id: string;
  title: string;
  periodType: 'WEEK' | 'MONTH';
  rewardType: 'POINTS' | 'PREMIUM_DAYS';
  startDate: string;
  endDate: string;
  payoutValues: number[];
}

type PlanStatus = 'Active' | 'Pending' | 'Expired';

function getPlanStatus(plan: BonusPlan): PlanStatus {
  const now = new Date();
  const start = new Date(plan.startDate);
  const end = new Date(plan.endDate);
  if (end < now) return 'Expired';
  if (start > now) return 'Pending';
  return 'Active';
}

const statusVariant: Record<PlanStatus, 'default' | 'secondary' | 'outline'> = {
  Active: 'default',
  Pending: 'secondary',
  Expired: 'outline',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface BonusPlanListProps {
  refreshKey: number;
  onEdit: (plan: BonusPlanInitialValues) => void;
  onRefresh: () => void;
}

export function BonusPlanList({ refreshKey, onEdit, onRefresh }: BonusPlanListProps) {
  const t = useTranslations('bonusPlans');
  const confirm = useConfirm();
  const [plans, setPlans] = useState<BonusPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.resolve(); // yield to avoid sync setState in effect body
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/bonus-plans');
        if (!res.ok) throw new Error('Failed to load bonus plans');
        const data: BonusPlan[] = await res.json();
        if (!cancelled) setPlans(data);
      } catch {
        if (!cancelled) setError(t('loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [refreshKey, t]);

  const handleDelete = async (plan: BonusPlan) => {
    const confirmed = await confirm({
      title: t('deleteConfirm.title'),
      message: t('deleteConfirm.message', { title: plan.title }),
      confirmLabel: t('deleteConfirm.confirmLabel'),
      isDestructive: true,
    });
    if (!confirmed) return;

    const res = await fetch(`/api/admin/bonus-plans/${plan.id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      onRefresh();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? 'Failed to delete bonus plan.');
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t('loading')}</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive py-6 text-center">{error}</p>;
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <Trophy className="h-10 w-10 opacity-30" />
        <p className="text-sm">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => {
        const status = getPlanStatus(plan);
        const statusLabel = t(status.toLowerCase() as 'active' | 'pending' | 'expired');
        const isExpired = status === 'Expired';

        return (
          <Card key={plan.id} className="bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">{plan.title}</CardTitle>
                    <Badge variant={statusVariant[status]}>{statusLabel}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {plan.periodType === 'WEEK' ? t('weekly') : t('monthly')} ·{' '}
                    {plan.rewardType === 'POINTS' ? t('points') : t('premiumDays')} ·{' '}
                    {format(new Date(plan.startDate), 'MMM d, yyyy')} –{' '}
                    {format(new Date(plan.endDate), 'MMM d, yyyy')}
                  </CardDescription>
                </div>

                {!isExpired && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={t('editAriaLabel')}
                      onClick={() =>
                        onEdit({
                          id: plan.id,
                          title: plan.title,
                          periodType: plan.periodType,
                          rewardType: plan.rewardType,
                          startDate: new Date(plan.startDate),
                          payoutValues: plan.payoutValues,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={t('deleteAriaLabel')}
                      onClick={() => handleDelete(plan)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1.5">
                {plan.payoutValues.map((val, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">#{i + 1}</span>
                    {val.toLocaleString()}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
