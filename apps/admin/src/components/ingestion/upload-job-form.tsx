'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { getSettings } from '@/app/actions/setting-actions';

export function UploadJobForm() {
  const router = useRouter();
  const t = useTranslations('system.ingestion.form');
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
    enhancementSpecialInstruction: '',
    scoutProvider: '',
    extractionProvider: '',
    enhancementProvider: ''
  });

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
              <Select value={formData.processType} onValueChange={(v) => v && handleSelect('processType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question-extraction">{t('questionExtraction')}</SelectItem>
                  <SelectItem value="quiz-generation">{t('quizGeneration')}</SelectItem>
                </SelectContent>
              </Select>
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
            {(['scoutProvider', 'extractionProvider', 'enhancementProvider'] as const).map((providerKey) => {
              const phase = providerKey.replace('Provider', '');
              const phaseSettings = settings.filter(s => s.key.startsWith(`ingestion_${phase}_`) && s.key !== `ingestion_${phase}_provider`);
              
              return (
                <div key={providerKey} className="space-y-2">
                  <Label>{t(providerKey as any)}</Label>
                  <Select value={formData[providerKey]} onValueChange={(v) => v && handleSelect(providerKey, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectProvider')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(['google', 'nvidia', 'deepseek', 'local'] as const).map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {t(`providers.${provider}` as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData[providerKey] && phaseSettings.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded-md space-y-1">
                      {phaseSettings.map(s => (
                        <div key={s.key} className="flex justify-between items-center gap-2">
                          <span className="font-medium truncate" title={s.label || s.key}>{s.label || s.key.replace(`ingestion_${phase}_`, '')}:</span>
                          <span className="truncate max-w-[150px]" title={s.value}>{s.value}</span>
                        </div>
                      ))}
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

