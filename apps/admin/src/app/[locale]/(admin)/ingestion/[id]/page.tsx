import { useTranslations } from 'next-intl';
import { JobDetail } from '@/components/ingestion/job-detail';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Job Details - TrivioQ Admin',
};

export default function JobDetailsPage({ params }: { params: { id: string } }) {
  const t = useTranslations('system.ingestion');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t('jobDetailsTitle')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {t('jobDetailsDesc')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/ingestion" />}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('back')}
          </Button>
        </div>
      </div>

      <JobDetail jobId={params.id} />
    </div>
  );
}
