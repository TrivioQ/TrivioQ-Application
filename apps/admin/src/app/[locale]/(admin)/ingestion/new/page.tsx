import { useTranslations } from 'next-intl';
import { UploadJobForm } from '@/components/ingestion/upload-job-form';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'New Ingestion Job - TrivioQ Admin',
};

export default function NewIngestionJobPage() {
  const t = useTranslations('system.ingestion');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t('newJob')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Upload a PDF and configure its processing settings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/ingestion" />}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <UploadJobForm />
    </div>
  );
}
