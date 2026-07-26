'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BonusPlanForm, type BonusPlanInitialValues } from '@/components/bonus-plans/bonus-plan-form';
import { BonusPlanList } from '@/components/bonus-plans/bonus-plan-list';
import { useTranslations } from 'next-intl';

type FormMode = { type: 'create' } | { type: 'edit'; plan: BonusPlanInitialValues } | null;

export default function BonusPlansPage() {
  const t = useTranslations('bonusPlans');
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleSuccess = () => {
    setFormMode(null);
    refresh();
  };

  const isFormOpen = formMode !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('description')}</p>
        </div>

        <Button onClick={() => setFormMode({ type: 'create' })} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {/* Create / Edit Form */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode?.type === 'edit' ? t('editPlan') : t('newPlan')}</DialogTitle>
            <DialogDescription>{t('formDescription')}</DialogDescription>
          </DialogHeader>

          {isFormOpen && (
            <div className="mt-4">
              <BonusPlanForm initialValues={formMode.type === 'edit' ? formMode.plan : undefined} onSuccess={handleSuccess} onCancel={() => setFormMode(null)} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* List */}
      <BonusPlanList refreshKey={refreshKey} onEdit={(plan) => setFormMode({ type: 'edit', plan })} onRefresh={refresh} />
    </div>
  );
}
