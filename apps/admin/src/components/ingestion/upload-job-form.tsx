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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
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

  /**
   * Upload via XHR so we get real upload-progress events.
   * fetch() does not expose upload progress; XHR's xhr.upload.onprogress does.
   */
  const uploadWithProgress = (data: FormData): Promise<{ id: string }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/v1/admin/ingestion/jobs');

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText).data);
        } else {
          const message = (() => {
            try {
              return JSON.parse(xhr.responseText)?.error ?? t('createError');
            } catch {
              return t('createError');
            }
          })();
          reject(new Error(message));
        }
      });

      xhr.addEventListener('error', () => reject(new Error(t('createError'))));
      xhr.send(data);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error(t('selectPdfError'));
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    try {
      const data = new FormData();
      data.append('pdf', file);

      Object.entries(formData).forEach(([key, value]) => {
        if (value) {
          data.append(key, value);
        }
      });

      await uploadWithProgress(data);

      toast.success(t('createSuccess'));
      router.push('/ingestion');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? t('createError'));
    } finally {
      setLoading(false);
      setUploadProgress(null);
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

      <div className="flex flex-col gap-3">
        {uploadProgress !== null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('uploading')}</span>
              <span>{uploadProgress}%</span>
            </div>
            {/* Pure-CSS progress bar — no extra dependency required */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>{t('cancel')}</Button>
          <Button type="submit" disabled={loading || !file}>
            {loading ? t('uploading') : t('startJob')}
          </Button>
        </div>
      </div>
    </form>
  );
}
