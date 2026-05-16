'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface JobLogModalTriggerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  jobId: string;
}

export function JobLogModalTrigger({ payload, result, jobId }: JobLogModalTriggerProps) {
  const t = useTranslations('system.jobLogs');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="xs" onClick={() => setOpen(true)}>
        {t('viewDetails')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('modal.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t('modal.jobId')}
              </h3>
              <p className="text-sm font-mono text-gray-700 bg-gray-50 rounded-lg p-2 break-all">
                {jobId}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t('modal.payload')}
              </h3>
              <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto border border-gray-100 max-h-64 overflow-y-auto">
                <code>{JSON.stringify(payload, null, 2)}</code>
              </pre>
            </div>
            {result != null && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {t('modal.result')}
                </h3>
                <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto border border-gray-100 max-h-64 overflow-y-auto">
                  <code>{JSON.stringify(result, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
