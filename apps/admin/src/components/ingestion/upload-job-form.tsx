'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AppSelect, type AppSelectOption } from '@/components/ui/app-select';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

interface StageConfig {
  stage: string;
  modelId: string | null;
  model: { id: string; displayName: string; modelName: string; provider: { displayName: string } | null } | null;
}

interface ModelRef {
  id: string;
  displayName: string;
  modelName: string;
  provider: { displayName: string } | null;
}

export function UploadJobForm() {
  const router = useRouter();
  const t = useTranslations('system.ingestion.form');
  const tApp = useTranslations('appSettings');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [models, setModels] = useState<ModelRef[]>([]);

  useEffect(() => {
    // Load stage configs (for default-model display) and the model list
    // (for the per-phase override dropdowns).
    Promise.all([
      fetch('/api/v1/admin/ingestion-stages').then(r => r.json()),
      fetch('/api/v1/admin/ai-models').then(r => r.json()),
    ]).then(([stagesRes, modelsRes]) => {
      if (stagesRes.success) setStages(stagesRes.data);
      if (modelsRes.success) setModels(modelsRes.data);
    }).catch(() => {
      // best-effort; form still usable without overrides
    });
  }, []);

  const [formData, setFormData] = useState<Record<string, string>>({
    processType: 'question-extraction',
    topic: '',
    pagesFrom: '',
    pagesTo: '',
    extractionSpecialInstruction: '',
    enhancementSpecialInstruction: '',
    scoutModelId: '',
    extractionModelId: '',
    enhancementModelId: '',
    generationModelId: '',
    summarizationModelId: '',
  });

  const getActivePhases = (processType: string) => {
    if (processType === 'quiz-generation') {
      return ['summarization', 'generation', 'enhancement'];
    }
    return ['scout', 'extraction', 'enhancement'];
  };

  const modelOptions: AppSelectOption[] = models.map(m => ({
    value: m.id,
    label: `${m.provider?.displayName ?? 'unknown'} → ${m.displayName}`,
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelect = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error(t('selectPdfError'));
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('pdf', file);

      Object.entries(formData).forEach(([key, value]) => {
        if (value) {
          data.append(key, value);
        }
      });

      const res = await fetch('/api/v1/admin/ingestion/jobs', {
        method: 'POST',
        body: data,
      });

      if (!res.ok) {
        throw new Error('Failed to create job');
      }

      toast.success(t('createSuccess'));
      router.push('/ingestion');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(t('createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>{t('pdfFile')}</Label>
            <Input 
              type="file" 
              accept=".pdf" 
              onChange={e => setFile(e.target.files?.[0] || null)} 
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('processType')}</Label>
              <AppSelect 
                value={formData.processType} 
                onValueChange={(v: any) => {
                  if (typeof v === 'string' && v) {
                    handleSelect('processType', v);
                  }
                }}
                placeholder={t('selectType')}
                options={[
                  { value: 'question-extraction', label: t('questionExtraction') },
                  { value: 'quiz-generation', label: t('quizGeneration') }
                ]}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('topic')}</Label>
              <Input 
                name="topic" 
                value={formData.topic} 
                onChange={handleChange} 
                placeholder={t('topicPlaceholder')} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('pageRangeFrom')}</Label>
              <Input 
                name="pagesFrom" 
                type="number" 
                value={formData.pagesFrom} 
                onChange={handleChange} 
                placeholder={t('pagePlaceholder')} 
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pageRangeTo')}</Label>
              <Input 
                name="pagesTo" 
                type="number" 
                value={formData.pagesTo} 
                onChange={handleChange} 
                placeholder={t('pageToPlaceholder')} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('extractionInstruction')}</Label>
            <Textarea 
              name="extractionSpecialInstruction" 
              value={formData.extractionSpecialInstruction} 
              onChange={handleChange} 
              placeholder={t('extractionInstructionPlaceholder')} 
            />
          </div>

          <div className="space-y-2">
            <Label>{t('enhancementInstruction')}</Label>
            <Textarea 
              name="enhancementSpecialInstruction" 
              value={formData.enhancementSpecialInstruction} 
              onChange={handleChange} 
              placeholder={t('enhancementInstructionPlaceholder')} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {getActivePhases(formData.processType).map((phase) => {
              const stageConfig = stages.find(s => s.stage === phase);
              const defaultModel = stageConfig?.model;
              const overrideKey = `${phase}ModelId`;
              return (
                <div key={phase} className="space-y-2">
                  <Label className="text-base font-semibold">
                    {phase === 'enhancement' ? t('enhancementPhaseOnly') : tApp(`phases.${phase}` as any)}
                  </Label>
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{t('defaultLabel')}</span>
                      <span className="text-right truncate" title={defaultModel ? `${defaultModel.provider?.displayName ?? ''} / ${defaultModel.modelName}` : t('noDefaultModel')}>
                        {defaultModel ? `${defaultModel.provider?.displayName ?? ''} → ${defaultModel.displayName}` : t('noDefaultModel')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('overrideModel')}</Label>
                    <AppSelect
                      options={modelOptions}
                      value={formData[overrideKey] ?? ''}
                      onValueChange={(v) => handleSelect(overrideKey, String(v))}
                      placeholder={t('useDefault')}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => router.back()}>{t('cancel')}</Button>
        <Button type="submit" disabled={loading || !file}>
          {loading ? t('uploading') : t('startJob')}
        </Button>
      </div>
    </form>
  );
}

