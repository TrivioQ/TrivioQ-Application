import { getTranslations } from 'next-intl/server';
import { makeServerAPICallV1 } from '@/lib/api-server';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('faqTitle'),
    description: t('faqDescription'),
  };
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default async function FAQPage() {
  const t = await getTranslations('faq');
  let faqs: FAQItem[] = [];
  try {
    faqs = await makeServerAPICallV1<FAQItem[]>('faqs');
  } catch (error) {
    console.error('[FAQPage] Failed to fetch FAQs:', error);
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text selection:bg-brand-500 selection:text-text pb-20">
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-500/10 blur-[120px] rounded-full -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-text via-brand-300 to-text">{t('title')}</h1>
          <p className="text-text-muted text-lg md:text-xl max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
      </div>

      {/* ── FAQ List ── */}
      <div className="max-w-3xl mx-auto px-6 space-y-6">
        {faqs.length > 0 ? (
          faqs.map((faq) => (
            <details key={faq.id} className="group bg-overlay/50 border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all duration-300">
              <summary className="flex items-center justify-between p-6 md:p-8 cursor-pointer list-none">
                <span className="text-lg md:text-xl font-bold pr-6 group-open:text-brand-400 transition-colors">{faq.question}</span>
                <span className="flex-shrink-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-transform group-open:rotate-180">
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <div className="px-6 md:px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="h-px w-full bg-white/5 mb-6" />
                <p className="text-text-muted text-lg leading-relaxed">{faq.answer}</p>
              </div>
            </details>
          ))
        ) : (
          <div className="text-center py-20 bg-overlay/30 rounded-3xl border border-dashed border-white/5">
            <p className="text-text-muted/70">{t('noFaqs')}</p>
          </div>
        )}
      </div>

      {/* ── Contact Section ── */}
      <div className="max-w-4xl mx-auto px-6 mt-20">
        <div className="bg-gradient-to-br from-brand-600/20 to-brand-600/20 border border-brand-500/20 rounded-[2.5rem] p-10 md:p-16 text-center space-y-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-text">{t('stillHaveQuestions')}</h2>
            <p className="text-text-muted max-w-lg mx-auto">{t('contactDesc')}</p>
          </div>
          <a href="mailto:support@trivioq.com" className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-text font-bold py-4 px-10 rounded-2xl transition-all shadow-lg shadow-brand-500/25 hover:-translate-y-1 active:translate-y-0">
            <span>{t('contactSupport')}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
