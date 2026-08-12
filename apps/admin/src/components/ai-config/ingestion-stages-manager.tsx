'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AppSelect, type AppSelectOption } from '@/components/ui/app-select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ModelRef {
  id: string;
  displayName: string;
  modelName: string;
  provider: { id: string; name: string; displayName: string; protocol: string } | null;
}

interface StageConfig {
  stage: string;
  model: { id: string; displayName: string; modelName: string; provider: { id: string; name: string; displayName: string; protocol: string } | null } | null;
  modelId: string | null;
  temperature: number;
  callDelaySec: number;
  batchSize: number | null;
  concurrency: number | null;
  specialInstruction: string | null;
  isActive: boolean;
  updatedAt: string;
}

const STAGE_ORDER = ['scout', 'extraction', 'enhancement', 'summarization', 'generation'] as const;


export function IngestionStagesManager() {
  const t = useTranslations('ingestionSettings');
  const tApp = useTranslations('appSettings');
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [models, setModels] = useState<ModelRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStage, setSavingStage] = useState<string | null>(null);

  const fetchStages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/ingestion-stages');
      const json = await res.json();
      if (json.success) {
        // Sort into canonical order, seeding any missing stage rows.
        const byStage = new Map<string, StageConfig>(json.data.map((s: StageConfig) => [s.stage, s]));
        const ordered: StageConfig[] = STAGE_ORDER.map(
          (stage) =>
            byStage.get(stage) ?? {
              stage,
              model: null,
              modelId: null,
              temperature: 0.2,
              callDelaySec: 10,
              batchSize: null,
              concurrency: null,
              specialInstruction: null,
              isActive: true,
              updatedAt: new Date().toISOString(),
            },
        );
        setStages(ordered);
      }
    } catch {
      toast.error(t('fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/ai-models');
      const json = await res.json();
      if (json.success) setModels(json.data);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStages();
    void fetchModels();
  }, [fetchStages, fetchModels]);

  // Group model options by provider for the dropdown.
  const modelOptions: AppSelectOption[] = models
    .filter((m) => m.provider)
    .map((m) => ({
      value: m.id,
      label: `${m.provider!.displayName} → ${m.displayName}`,
    }));

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const updateStage = (stage: string, patch: Partial<StageConfig>) => {
    setStages((prev) => prev.map((s) => (s.stage === stage ? { ...s, ...patch } : s)));
  };

  const handleSave = async (stage: StageConfig) => {
    setSavingStage(stage.stage);
    try {
      const body: Record<string, unknown> = {
        modelId: stage.modelId || null,
        temperature: Number(stage.temperature),
        callDelaySec: Number(stage.callDelaySec),
        batchSize: stage.batchSize != null ? Number(stage.batchSize) : null,
        concurrency: stage.concurrency != null ? Number(stage.concurrency) : null,
        specialInstruction: stage.specialInstruction || null,
        isActive: stage.isActive,
      };
      const res = await fetch(`/api/v1/admin/ingestion-stages/${stage.stage}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
      toast.success(t('saved', { stage: tApp(`phases.${stage.stage}` as any) }));
      await fetchStages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSavingStage(null);
    }
  };

  return (
    <div className="space-y-4">
      {models.length === 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-400">
          {t('noModelsWarning')}
        </div>
      )}

      {stages.map((stage) => {
        const isExtraction = stage.stage === 'extraction';
        const isEnhancement = stage.stage === 'enhancement';
        return (
          <Card key={stage.stage}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{tApp(`phases.${stage.stage}` as any)}</CardTitle>
                  <CardDescription className="font-mono text-xs">{stage.stage}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">{t('active')}</Label>
                  <Switch checked={stage.isActive} onCheckedChange={(c) => updateStage(stage.stage, { isActive: c })} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('fieldModel')}</Label>
                <AppSelect
                  options={modelOptions}
                  value={stage.modelId ?? ''}
                  onValueChange={(v) => updateStage(stage.stage, { modelId: String(v) })}
                  placeholder={t('placeholderModel')}
                />
                {stage.model && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {stage.model.provider?.displayName} / {stage.model.modelName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('fieldTemperature')}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={stage.temperature}
                    onChange={(e) => updateStage(stage.stage, { temperature: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('fieldDelay')}</Label>
                  <Input
                    type="number"
                    value={stage.callDelaySec}
                    onChange={(e) => updateStage(stage.stage, { callDelaySec: Number(e.target.value) })}
                  />
                </div>
                {isExtraction && (
                  <div className="space-y-1.5">
                    <Label>{t('fieldBatchSize')}</Label>
                    <Input
                      type="number"
                      value={stage.batchSize ?? ''}
                      onChange={(e) => updateStage(stage.stage, { batchSize: e.target.value ? Number(e.target.value) : null })}
                      placeholder={t('placeholderBatchSize')}
                    />
                  </div>
                )}
                {isEnhancement && (
                  <div className="space-y-1.5">
                    <Label>{t('fieldConcurrency')}</Label>
                    <Input
                      type="number"
                      value={stage.concurrency ?? ''}
                      onChange={(e) => updateStage(stage.stage, { concurrency: e.target.value ? Number(e.target.value) : null })}
                      placeholder={t('placeholderConcurrency')}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>{t('fieldSpecialInstruction')}</Label>
                <Textarea
                  value={stage.specialInstruction ?? ''}
                  onChange={(e) => updateStage(stage.stage, { specialInstruction: e.target.value })}
                  placeholder={t('placeholderInstruction')}
                  rows={2}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void handleSave(stage)} disabled={savingStage === stage.stage}>
                  {savingStage === stage.stage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
