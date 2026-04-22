import Link from 'next/link';

export default function Home() {
  return (
    <div className='flex flex-col min-h-screen bg-gray-950 text-white selection:bg-indigo-500 selection:text-white'>
      {/* Hero Section */}
      <section className='relative pt-32 pb-20 px-6 lg:px-8 overflow-hidden flex-grow flex items-center'>
        <div className='absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/50 via-gray-950 to-black'></div>
        <div className='mx-auto max-w-5xl text-center'>
          <div className='inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-500/30 mb-8 bg-indigo-500/10'>Now available on iOS & Android</div>
          <h1 className='text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight'>
            Master the World Through <br />
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400'>Spontaneous Micro-Learning</span>
          </h1>
          <p className='mt-6 text-lg md:text-2xl leading-relaxed text-gray-300 max-w-3xl mx-auto mb-10'>Trivioq drops bite-sized, high-quality trivia directly to your device throughout the day. Build your knowledge organically, without dedicating hours to study.</p>
          <div className='mt-10 flex flex-col sm:flex-row items-center justify-center gap-6'>
            <Link href='#' className='rounded-full bg-indigo-500 px-8 py-4 text-lg font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:bg-indigo-400 hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all duration-300 transform hover:-translate-y-1 w-full sm:w-auto'>
              Download App
            </Link>
            <Link href='/leaderboard' className='group text-lg font-semibold leading-6 text-white hover:text-indigo-300 transition-colors flex items-center gap-2'>
              View Global Leaderboard
              <span aria-hidden='true' className='group-hover:translate-x-1 transition-transform'>
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className='py-24 px-6 sm:px-8 bg-black relative border-t border-white/5'>
        <div className='mx-auto max-w-7xl'>
          <div className='mx-auto max-w-2xl lg:text-center'>
            <h2 className='text-base font-semibold leading-7 text-indigo-400 uppercase tracking-widest'>Learn Faster</h2>
            <p className='mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl'>Knowledge engineered for the modern attention span</p>
          </div>
          <div className='mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none'>
            <dl className='grid max-w-xl grid-cols-1 gap-x-12 gap-y-16 lg:max-w-none lg:grid-cols-3'>
              <div className='flex flex-col bg-gray-900/50 p-8 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-colors'>
                <dt className='flex items-center gap-x-4 text-xl font-semibold leading-7 text-white'>
                  <div className='h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-2xl'>⚡</div>
                  Rapid Fire Drops
                </dt>
                <dd className='mt-6 flex flex-auto flex-col text-base leading-7 text-gray-400'>
                  <p className='flex-auto'>Receive unexpected, high-quality questions delivered right when you least expect them. You have 15 minutes to answer or the drop expires.</p>
                </dd>
              </div>
              <div className='flex flex-col bg-gray-900/50 p-8 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-colors'>
                <dt className='flex items-center gap-x-4 text-xl font-semibold leading-7 text-white'>
                  <div className='h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-2xl'>🧠</div>
                  Smart Tailoring
                </dt>
                <dd className='mt-6 flex flex-auto flex-col text-base leading-7 text-gray-400'>
                  <p className='flex-auto'>Adjust your active windows and category preferences. Our algorithm learns and adapts to your difficulty level to keep you challenged.</p>
                </dd>
              </div>
              <div className='flex flex-col bg-gray-900/50 p-8 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-colors'>
                <dt className='flex items-center gap-x-4 text-xl font-semibold leading-7 text-white'>
                  <div className='h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-2xl'>🏆</div>
                  Global Competition
                </dt>
                <dd className='mt-6 flex flex-auto flex-col text-base leading-7 text-gray-400'>
                  <p className='flex-auto'>Maintain your daily streak and climb the global leaderboards. Challenge your friends to beat your high score and earn bragging rights.</p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
