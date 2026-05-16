import { marked } from 'marked';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('privacyTitle'),
    description: t('privacyDescription'),
  };
}

type LegalDoc = { title: string; content: string; version: string; updatedAt: string };

export default async function PrivacyPage() {
  const t = await getTranslations('legal');
  const doc = await makeServerAPICallV1<LegalDoc>('legal/privacy', { next: { revalidate: 3600 } }).catch(() => null);

  return (
    <main className='min-h-screen bg-slate-950 text-slate-100 py-12 px-4'>
      <div className='max-w-3xl mx-auto'>{doc ? <article className='prose prose-invert prose-slate max-w-none' dangerouslySetInnerHTML={{ __html: marked(doc.content) }} /> : <p className='text-slate-400 text-center'>{t('privacyUnavailable')}</p>}</div>
    </main>
  );
}
