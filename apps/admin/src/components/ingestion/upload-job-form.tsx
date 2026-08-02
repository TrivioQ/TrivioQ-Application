'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AppSelect } from '@/components/ui/app-select';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { getSettings } from '@/app/actions/setting-actions';

export function UploadJobForm() {
  const router = useRouter();
  const t = useTranslations('system.ingestion.form');
  const tApp = useTranslations('appSettings');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<any[]>([]);

  useEffect(() => {
    getSettings({ pageSize: 1000 }).then(res => {
      if (res.success && res.data) {
        setSettings(res.data);
      }
    });
  }, []);

  const [formData, setFormData] = useState({
    processType: 'question-extraction',
    topic: '',
    pagesFrom: '',
    pagesTo: '',
    extractionSpecialInstruction: '',
    enhancementSpecialInstruction: ''
  });

  const getActivePhases = (processType: string) => {
    if (processType === 'quiz-generation') {
      return ['summarization', 'generation', 'enhancement'];
    }
    return ['scout', 'extraction', 'enhancement'];
  };

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
              const providerSetting = settings.find(s => s.key === `ingestion_${phase}_provider`);
              const providerName = providerSetting ? providerSetting.value : 'unknown';
              const displayProvider = ['google', 'nvidia', 'deepseek', 'local'].includes(providerName) 
                ? tApp(`providers.${providerName}` as any) 
                : providerName === 'unknown' ? t('unknownProvider') : providerName;
              const phaseSettings = settings.filter(s => s.key.startsWith(`ingestion_${phase}_`) && s.key !== `ingestion_${phase}_provider`);
              
              return (
                <div key={phase} className="space-y-2">
                  <Label className="text-base font-semibold">
                    {phase === 'enhancement' ? t('enhancementPhaseOnly') : tApp(`phases.${phase}` as any)}
                  </Label>
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    {t('providerLabel')} {displayProvider}
                  </div>
                  {phaseSettings.length > 0 ? (
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md space-y-1">
                      {phaseSettings.map(s => (
                        <div key={s.key} className="flex justify-between items-center gap-2 overflow-hidden">
                          <span className="font-medium truncate min-w-0 flex-shrink-0" title={s.label || s.key}>{s.label || s.key.replace(`ingestion_${phase}_`, '')}:</span>
                          <span className="truncate min-w-0 text-right text-foreground" title={s.value}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md italic">
                      {t('noAdditionalSettings')}
                    </div>
                  )}
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

