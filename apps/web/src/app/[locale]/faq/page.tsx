import { makeServerAPICallV1 } from '@/lib/api-server';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ | TrivioQ',
  description: 'Frequently asked questions about TrivioQ trivia drops, scoring, and accounts.',
};

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default async function FAQPage() {
  let faqs: FAQItem[] = [];
  try {
    faqs = await makeServerAPICallV1<FAQItem[]>('faqs');
  } catch (error) {
    console.error('[FAQPage] Failed to fetch FAQs:', error);
  }

  return (
    <div className='min-h-screen bg-gray-950 text-white selection:bg-indigo-500 selection:text-white pb-20'>
      {/* ── Hero Section ── */}
      <div className='relative overflow-hidden pt-20 pb-16 px-6'>
        <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10' />

        <div className='max-w-4xl mx-auto text-center space-y-4'>
          <h1 className='text-5xl md:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-white'>Frequently Asked Questions</h1>
          <p className='text-gray-400 text-lg md:text-xl max-w-2xl mx-auto'>Everything you need to know about TrivioQ. Can't find the answer? Contact our support team.</p>
        </div>
      </div>

      {/* ── FAQ List ── */}
      <div className='max-w-3xl mx-auto px-6 space-y-6'>
        {faqs.length > 0 ? (
          faqs.map((faq) => (
            <details key={faq.id} className='group bg-gray-900/50 border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all duration-300'>
              <summary className='flex items-center justify-between p-6 md:p-8 cursor-pointer list-none'>
                <span className='text-lg md:text-xl font-bold pr-6 group-open:text-indigo-400 transition-colors'>{faq.question}</span>
                <span className='flex-shrink-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-transform group-open:rotate-180'>
                  <svg className='w-4 h-4 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                  </svg>
                </span>
              </summary>
              <div className='px-6 md:px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-300'>
                <div className='h-px w-full bg-white/5 mb-6' />
                <p className='text-gray-400 text-lg leading-relaxed'>{faq.answer}</p>
              </div>
            </details>
          ))
        ) : (
          <div className='text-center py-20 bg-gray-900/30 rounded-3xl border border-dashed border-white/5'>
            <p className='text-gray-500'>No FAQs found. Check back soon!</p>
          </div>
        )}
      </div>

      {/* ── Contact Section ── */}
      <div className='max-w-4xl mx-auto px-6 mt-20'>
        <div className='bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-[2.5rem] p-10 md:p-16 text-center space-y-8 relative overflow-hidden group'>
          <div className='absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
          <div className='space-y-4'>
            <h2 className='text-3xl font-bold text-white'>Still have questions?</h2>
            <p className='text-gray-400 max-w-lg mx-auto'>We're here to help! Send us a message and we'll get back to you as soon as possible.</p>
          </div>
          <a href='mailto:support@trivioq.com' className='inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-4 px-10 rounded-2xl transition-all shadow-lg shadow-indigo-500/25 hover:-translate-y-1 active:translate-y-0'>
            <span>Contact Support</span>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 8l4 4m0 0l-4 4m4-4H3' />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
