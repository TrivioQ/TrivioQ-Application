import { AuditLogsClient } from './audit-logs-client';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'auditLogs' });
  
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function AuditLogsPage() {
  const t = await getTranslations('auditLogs');

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>
      <AuditLogsClient />
    </div>
  );
}
