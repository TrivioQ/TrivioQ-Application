'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BonusPlanForm, type BonusPlanInitialValues } from '@/components/bonus-plans/bonus-plan-form';
import { BonusPlanList } from '@/components/bonus-plans/bonus-plan-list';

type FormMode = { type: 'create' } | { type: 'edit'; plan: BonusPlanInitialValues } | null;

export default function BonusPlansPage() {
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bonus Plans</h1>
          <p className="mt-2 text-gray-500">
            Create weekly or monthly bonus plans to reward top-ranked players with points or premium days.
          </p>
        </div>

        {!isFormOpen && (
          <Button onClick={() => setFormMode({ type: 'create' })} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        )}
      </div>

      {/* Create / Edit Form */}
      {isFormOpen && (
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {formMode.type === 'edit' ? 'Edit Bonus Plan' : 'New Bonus Plan'}
                </CardTitle>
                <CardDescription>
                  Configure the period, reward type, and payout values for each rank.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setFormMode(null)}
                aria-label="Close form"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <BonusPlanForm
              initialValues={formMode.type === 'edit' ? formMode.plan : undefined}
              onSuccess={handleSuccess}
              onCancel={() => setFormMode(null)}
            />
          </CardContent>
        </Card>
      )}

      {/* List */}
      <BonusPlanList
        refreshKey={refreshKey}
        onEdit={(plan) => setFormMode({ type: 'edit', plan })}
        onRefresh={refresh}
      />
    </div>
  );
}
