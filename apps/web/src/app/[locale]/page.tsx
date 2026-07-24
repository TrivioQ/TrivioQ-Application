import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function Home() {
  const t = useTranslations('home');
  return (
    <div className="flex flex-col min-h-screen text-gray-900 dark:text-white selection:bg-indigo-500 selection:text-white">
      {/* ── Hero Section ── */}
      <section className="relative pt-16 pb-20 px-6 lg:px-8 overflow-hidden flex-grow flex items-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white dark:from-indigo-900/50 dark:via-gray-950 dark:to-black" />
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/30 dark:ring-indigo-500/30 mb-8 bg-indigo-50 dark:bg-indigo-500/10">{t('badge')}</div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight text-gray-900 dark:text-white">
            {t('titlePrefix')} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">{t('titleHighlight')}</span>
          </h1>
          <p className="mt-6 text-lg md:text-2xl leading-relaxed text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-10">{t('description')}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* iOS Download */}
            <Link href="#" className="flex items-center gap-3 rounded-2xl bg-black dark:bg-white/10 border border-white/10 px-6 py-3.5 text-white dark:text-white hover:bg-gray-900 dark:hover:bg-white/20 transition-all duration-200 shadow-lg w-full sm:w-auto">
              <span className="text-2xl">🍎</span>
              <div className="text-left">
                <div className="text-xs text-gray-400 dark:text-gray-300">Download on the</div>
                <div className="text-base font-bold">App Store</div>
              </div>
            </Link>
            {/* Android Download */}
            <Link href="#" className="flex items-center gap-3 rounded-2xl bg-black dark:bg-white/10 border border-white/10 px-6 py-3.5 text-white dark:text-white hover:bg-gray-900 dark:hover:bg-white/20 transition-all duration-200 shadow-lg w-full sm:w-auto">
              <span className="text-2xl">▶️</span>
              <div className="text-left">
                <div className="text-xs text-gray-400 dark:text-gray-300">Get it on</div>
                <div className="text-base font-bold">Google Play</div>
              </div>
            </Link>
            <Link href="/leaderboard" className="group text-base font-semibold leading-6 text-gray-700 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex items-center gap-2">
              {t('leaderboardLink')}
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social Proof Strip ── */}
      <section className="py-10 px-6 border-y border-gray-100 dark:border-white/5 bg-white/50 dark:bg-white/2">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-8 text-center">
          <div>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">10,000+</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active learners</p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200 dark:bg-white/10" />
          <div>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">4.8 ⭐</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Average rating</p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200 dark:bg-white/10" />
          <div>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">500K+</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Questions answered</p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200 dark:bg-white/10" />
          <div className="max-w-xs">
            <p className="text-sm italic text-gray-600 dark:text-gray-300">&ldquo;TrivioQ made me smarter without feeling like studying. I&apos;m obsessed.&rdquo;</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">— @alex_learns, Top 5 Leaderboard</p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 px-6 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">How it works</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">What is a Drop?</p>
            <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg">
              A <strong>Drop</strong> is a daily trivia question delivered straight to you. You have a limited window to reveal, answer, and compete — before it expires.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '📬', title: 'Get Your Drop', desc: 'A fresh question drops daily. You get a notification — tap to reveal before the timer runs out.' },
              { step: '02', icon: '🧠', title: 'Reveal & Answer', desc: 'Study the question, use a hint if you need it, then lock in your answer. Speed matters for bonus points.' },
              { step: '03', icon: '🏆', title: 'Climb the Board', desc: 'Earn points, build your streak, and compete on the live global leaderboard. Top players win recognition.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="relative flex flex-col items-start p-8 bg-white/60 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 backdrop-blur-sm">
                <div className="text-xs font-bold tracking-widest text-indigo-500 dark:text-indigo-400 mb-4 uppercase">{step}</div>
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-24 px-6 sm:px-8 relative border-t border-gray-100/50 dark:border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{t('features.tagline')}</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">{t('features.heading')}</p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-12 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="flex flex-col bg-indigo-50/60 dark:bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-indigo-100 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors shadow-sm dark:shadow-none">
                <dt className="flex items-center gap-x-4 text-xl font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 dark:border-indigo-500/30 text-2xl">⚡</div>
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
              <div className="flex flex-col bg-indigo-50/60 dark:bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-indigo-100 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors shadow-sm dark:shadow-none">
                <dt className="flex items-center gap-x-4 text-xl font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 dark:border-indigo-500/30 text-2xl">🏆</div>
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
