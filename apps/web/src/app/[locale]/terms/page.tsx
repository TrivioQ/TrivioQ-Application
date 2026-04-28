import { marked } from 'marked';
import { env } from '@/../env.mjs';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Terms of Service | TrivioQ',
  description: 'TrivioQ Terms of Service — your rights and responsibilities when using our platform.',
};

async function fetchLegalDoc(slug: string): Promise<{ title: string; content: string; version: string; updatedAt: string } | null> {
  try {
    const res = await fetch(`${env.API_URL}/v1/legal/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function TermsPage() {
  const t = await getTranslations('legal');
  const doc = await fetchLegalDoc('terms');

  return (
    <main className='min-h-screen bg-slate-950 text-slate-100 py-12 px-4'>
      <div className='max-w-3xl mx-auto'>{doc ? <article className='prose prose-invert prose-slate max-w-none' dangerouslySetInnerHTML={{ __html: marked(doc.content) }} /> : <p className='text-slate-400 text-center'>{t('termsUnavailable')}</p>}</div>
    </main>
  );
}
