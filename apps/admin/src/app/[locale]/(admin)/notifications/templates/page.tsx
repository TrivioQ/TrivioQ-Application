'use client';

import { use } from 'react';
import { TemplateList } from '@/components/template-list';
import { CreateTemplateDialog } from '@/components/create-template-dialog';
import { Sparkles } from 'lucide-react';

export default function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Sparkles className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Templates</h1>
            <p className="text-sm text-gray-500">
              Reusable templates with variable substitution
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
            <h3 className="font-medium text-blue-900">About Templates</h3>
            <p className="text-sm text-blue-700 mt-1">
              Templates allow you to create reusable notification formats with placeholders like{' '}
              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">{'{{userName}}'}</code>,{' '}
              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">{'{{expiryDate}}'}</code>, etc.
              When creating a notification from a template, these variables are replaced with actual values.
            </p>
          </div>
        </div>
      </div>

      {/* Template List */}
      <TemplateList />
    </div>
  );
}