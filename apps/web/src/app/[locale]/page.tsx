import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function Home() {
  const t = useTranslations('home');
  return (
    <div className="flex flex-col min-h-screen text-gray-900 dark:text-white selection:bg-blue-500 selection:text-white">
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 lg:px-8 overflow-hidden flex-grow flex items-center">
        {/* Light mode: blue-to-white gradient; Dark mode: indigo-to-black */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white dark:from-indigo-900/50 dark:via-gray-950 dark:to-black" />
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-blue-600 dark:text-indigo-300 ring-1 ring-inset ring-blue-500/30 dark:ring-indigo-500/30 mb-8 bg-blue-50 dark:bg-indigo-500/10">
            {t('badge')}
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-gray-900 dark:text-white">
            {t('titlePrefix')} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-orange-400 to-blue-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
              {t('titleHighlight')}
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-2xl leading-relaxed text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-10">
            {t('description')}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              href="#"
              className="rounded-full bg-blue-500 dark:bg-indigo-500 px-8 py-4 text-lg font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] dark:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:bg-blue-400 dark:hover:bg-indigo-400 hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto"
            >
              {t('downloadButton')}
            </Link>
            <Link
              href="/leaderboard"
              className="group text-lg font-semibold leading-6 text-gray-700 dark:text-white hover:text-blue-600 dark:hover:text-indigo-300 transition-colors flex items-center gap-2"
            >
              {t('leaderboardLink')}
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 sm:px-8 relative border-t border-gray-100/50 dark:border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-indigo-400 uppercase tracking-widest">
              {t('features.tagline')}
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {t('features.heading')}
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-12 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="flex flex-col bg-blue-50/60 dark:bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-blue-100 dark:border-white/5 hover:border-blue-300 dark:hover:border-indigo-500/30 transition-colors shadow-sm dark:shadow-none">
                <dt className="flex items-center gap-x-4 text-xl font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-blue-500/20 dark:border-indigo-500/30 text-2xl">⚡</div>
                  {t('features.rapidFire.title')}
                </dt>
                <dd className="mt-6 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-400">
                  <p className="flex-auto">{t('features.rapidFire.description')}</p>
                </dd>
              </div>
              {/* Feature 2 */}
              <div className="flex flex-col bg-orange-50/60 dark:bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-orange-100 dark:border-white/5 hover:border-orange-300 dark:hover:border-indigo-500/30 transition-colors shadow-sm dark:shadow-none">
                <dt className="flex items-center gap-x-4 text-xl font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 dark:bg-purple-500/20 flex items-center justify-center border border-orange-500/20 dark:border-purple-500/30 text-2xl">🧠</div>
                  {t('features.smartTailoring.title')}
                </dt>
                <dd className="mt-6 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-400">
                  <p className="flex-auto">{t('features.smartTailoring.description')}</p>
                </dd>
              </div>
              {/* Feature 3 */}
              <div className="flex flex-col bg-blue-50/60 dark:bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-blue-100 dark:border-white/5 hover:border-blue-300 dark:hover:border-indigo-500/30 transition-colors shadow-sm dark:shadow-none">
                <dt className="flex items-center gap-x-4 text-xl font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center border border-blue-500/20 dark:border-blue-500/30 text-2xl">🏆</div>
                  {t('features.globalCompetition.title')}
                </dt>
                <dd className="mt-6 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-400">
                  <p className="flex-auto">{t('features.globalCompetition.description')}</p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
