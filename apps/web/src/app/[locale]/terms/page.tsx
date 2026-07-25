import { marked } from 'marked';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('termsTitle'),
    description: t('termsDescription'),
  };
}

type LegalDoc = { title: string; content: string; version: string; updatedAt: string };

export default async function TermsPage() {
  const t = await getTranslations('legal');
  const doc = await makeServerAPICallV1<LegalDoc>('legal/terms', { next: { revalidate: 3600 } }).catch(() => null);

  return (
    <main className="min-h-screen bg-bg-primary text-text py-12 px-4">
      <div className="max-w-3xl mx-auto">{doc ? <article className="prose prose-invert prose max-w-none" dangerouslySetInnerHTML={{ __html: marked(doc.content) }} /> : <p className="text-text-muted text-center">{t('termsUnavailable')}</p>}</div>
    </main>
  );
}
