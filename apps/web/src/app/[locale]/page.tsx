import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { Users, CheckCircle, Layers } from 'lucide-react';

export default async function Home() {
  const t = await getTranslations('home');

  let stats = { activeLearners: 1000, questionsAnswered: 50000, activeCategories: 30 };
  try {
    stats = await makeServerAPICallV1<{ activeLearners: number; questionsAnswered: number; activeCategories: number }>('stats', { next: { revalidate: 3600 } });
  } catch (error) {
    console.error('Failed to fetch stats for home page:', error);
  }

  const formattedLearners = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.activeLearners) + '+';
  const formattedQuestions = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.questionsAnswered) + '+';
  const formattedCategories = stats.activeCategories + '+';
  return (
    <div className="flex flex-col min-h-screen text-text selection:bg-brand-500 selection:text-text">
      {/* ── Hero Section ── */}
      <section className="relative pt-10 pb-28 md:pt-16 md:pb-36 px-4 sm:px-6 lg:px-8 overflow-hidden flex-grow flex items-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100 via-bg to-bg-secondary dark:from-brand-900/50 dark:via-bg-primary dark:to-overlay" />
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-brand-600 dark:text-brand-300 ring-1 ring-inset ring-brand-500/30 dark:ring-brand-500/30 mb-8 bg-brand-50 dark:bg-brand-500/10">{t('badge')}</div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-text">
            {t('titlePrefix')} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-brand-300 to-brand-500 dark:from-brand-400 dark:via-brand-300 dark:to-brand-400">{t('titleHighlight')}</span>
          </h1>
          <p className="mt-6 text-lg md:text-2xl leading-relaxed text-text-muted max-w-3xl mx-auto mb-10">{t('description')}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            {/* iOS Download */}
            <Link href="#" className="flex items-center gap-3 rounded-2xl bg-overlay dark:bg-white/10 border border-white/10 px-6 py-3.5 text-white hover:bg-overlay/80 dark:hover:bg-white/20 transition-all duration-200 shadow-lg w-full sm:w-auto">
              <svg className="w-6 h-6 fill-current text-white shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.67-.82 1.13-1.96.99-3.1-.97.04-2.18.65-2.87 1.46-.62.72-1.16 1.88-1.01 3.01 1.09.08 2.22-.55 2.89-1.37z" />
              </svg>
              <div className="text-left">
                <div className="text-xs text-white/70 font-medium">{t('appStorePrefix')}</div>
                <div className="text-base font-bold -mt-0.5">{t('appStoreTitle')}</div>
              </div>
            </Link>
            {/* Android Download */}
            <Link href="#" className="flex items-center gap-3 rounded-2xl bg-overlay dark:bg-white/10 border border-white/10 px-6 py-3.5 text-white hover:bg-overlay/80 dark:hover:bg-white/20 transition-all duration-200 shadow-lg w-full sm:w-auto">
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#00D2FF" d="M3.609 1.814L13.792 12 3.61 22.186a2.37 2.37 0 0 1-.61-1.614V3.428c0-.623.228-1.205.61-1.614z" />
                <path fill="#FFD400" d="M17.26 8.532l-3.468 3.468 3.468 3.468 3.96-2.261a2.316 2.316 0 0 0 0-4.414l-3.96-2.261z" />
                <path fill="#00F076" d="M3.609 1.814L14.77 8.196l-2.446 2.446L3.609 1.814z" />
                <path fill="#FF3A44" d="M3.609 22.186l8.715-8.715 2.446 2.446-11.161 6.382z" />
              </svg>
              <div className="text-left">
                <div className="text-xs text-white/70 font-medium">{t('googlePlayPrefix')}</div>
                <div className="text-base font-bold -mt-0.5">{t('googlePlayTitle')}</div>
              </div>
            </Link>
            <Link href="/leaderboard" className="group text-base font-semibold leading-6 text-text-muted hover:text-brand-600 dark:hover:text-brand-300 transition-colors flex items-center gap-2">
              {t('leaderboardLink')}
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social Proof Cards ── */}
      <section className="px-4 sm:px-6 relative z-10 -mt-16 md:-mt-20 mb-10">
        <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-b from-white/80 to-brand-100/60 dark:from-white/10 dark:to-white/5 rounded-3xl border border-brand-200 dark:border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-1">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <p className="text-4xl font-extrabold text-text bg-clip-text text-transparent bg-gradient-to-br from-text to-text-muted">{formattedLearners}</p>
            </div>
            <p className="text-xs font-bold text-text-muted mt-2 uppercase tracking-widest">{t('socialProof.activeLearners')}</p>
          </div>
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-b from-white/80 to-brand-100/60 dark:from-white/10 dark:to-white/5 rounded-3xl border border-brand-200 dark:border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-1">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <p className="text-4xl font-extrabold text-text bg-clip-text text-transparent bg-gradient-to-br from-text to-text-muted">{formattedQuestions}</p>
            </div>
            <p className="text-xs font-bold text-text-muted mt-2 uppercase tracking-widest">{t('socialProof.questionsAnswered')}</p>
          </div>
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-gradient-to-b from-white/80 to-brand-100/60 dark:from-white/10 dark:to-white/5 rounded-3xl border border-brand-200 dark:border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-1">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/20 flex items-center justify-center">
                <Layers className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              </div>
              <p className="text-4xl font-extrabold text-text bg-clip-text text-transparent bg-gradient-to-br from-text to-text-muted">{formattedCategories}</p>
            </div>
            <p className="text-xs font-bold text-text-muted mt-2 uppercase tracking-widest">{t('socialProof.categories')}</p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-base font-semibold leading-7 text-brand-600 dark:text-brand-400 uppercase tracking-widest">{t('howItWorks.tagline')}</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-text sm:text-4xl">{t('howItWorks.heading')}</p>
            <p className="mt-4 text-text-muted max-w-2xl mx-auto text-lg">{t('howItWorks.description')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '📬', title: t('howItWorks.step1Title'), desc: t('howItWorks.step1Desc') },
              { step: '02', icon: '🧠', title: t('howItWorks.step2Title'), desc: t('howItWorks.step2Desc') },
              { step: '03', icon: '🏆', title: t('howItWorks.step3Title'), desc: t('howItWorks.step3Desc') },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="relative flex flex-col items-start p-5 sm:p-8 bg-bg-secondary/75 dark:bg-white/5 rounded-2xl border border-brand-100 dark:border-white/10 backdrop-blur-sm shadow-sm shadow-brand-500/10">
                <div className="text-xs font-bold tracking-widest text-brand-500 dark:text-brand-400 mb-4 uppercase">{step}</div>
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-14 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 relative border-t border-border/50 dark:border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-brand-600 dark:text-brand-400 uppercase tracking-widest">{t('features.tagline')}</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-text sm:text-4xl">{t('features.heading')}</p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 md:max-w-3xl lg:max-w-none lg:grid-cols-3 lg:gap-x-12 lg:gap-y-16">
              {[
                { icon: '⚡', title: t('features.rapidFire.title'), desc: t('features.rapidFire.description') },
                { icon: '🧠', title: t('features.smartTailoring.title'), desc: t('features.smartTailoring.description') },
                { icon: '🏆', title: t('features.globalCompetition.title'), desc: t('features.globalCompetition.description') },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex flex-col bg-brand-50/75 dark:bg-overlay/50 backdrop-blur-sm p-8 rounded-2xl border border-brand-100 dark:border-white/5 shadow-sm shadow-brand-500/10 dark:shadow-none">
                  <dt className="flex items-center gap-x-4 text-xl font-semibold leading-7 text-text">
                    <div className="h-12 w-12 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center border border-brand-500/20 dark:border-brand-500/30 text-2xl">{icon}</div>
                    {title}
                  </dt>
                  <dd className="mt-6 flex flex-auto flex-col text-base leading-7 text-text-muted">
                    <p className="flex-auto">{desc}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
