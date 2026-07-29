import { useTranslations } from 'next-intl';
import { CronJobList } from '@/components/cron-jobs/cron-job-list';

export const metadata = {
  title: 'Cron Jobs - TrivioQ Admin',
};

export default function CronJobsPage() {
  const t = useTranslations('cronJobs');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
      </div>

      <CronJobList />
    </div>
  );
}
