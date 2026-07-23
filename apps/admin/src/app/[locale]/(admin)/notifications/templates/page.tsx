'use client';

import { TemplateList } from '@/components/template-list';
import { CreateTemplateDialog } from '@/components/create-template-dialog';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function TemplatesPage() {
  const t = useTranslations('notifications.templates');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Sparkles className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
            <p className="text-sm text-gray-500">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <CreateTemplateDialog />
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">{t('aboutTitle')}</h3>
            <p className="text-sm text-blue-700 mt-1">
              {t('aboutDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Template List */}
      <TemplateList />
    </div>
  );
}