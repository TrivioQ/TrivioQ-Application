import Link from 'next/link';
import { ErrorNotification } from '../../components/ErrorNotification';
import { makeServerAPICallV1 } from '../../lib/apiServer';
import { LeaderboardTabs } from '../../components/LeaderboardTabs';

export const revalidate = 60; // Revalidate the leaderboard every 60 seconds

interface LeaderboardUser {
  id: string;
  username: string;
  displayName: string | null;
  cumulativeScore: number;
  currentStreak: number;
}

export default async function LeaderboardPage() {
  let leaderboardData = {
    weekly: [] as LeaderboardUser[],
    monthly: [] as LeaderboardUser[],
    alltime: [] as LeaderboardUser[],
  };
  let fetchFailed = false;

  try {
    const [weekly, monthly, alltime] = await Promise.all([makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/global?period=weekly'), makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/global?period=monthly'), makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/global?period=alltime')]);

    leaderboardData = {
      weekly: weekly.leaderboard ?? [],
      monthly: monthly.leaderboard ?? [],
      alltime: alltime.leaderboard ?? [],
    };
  } catch (error) {
    console.error('[LeaderboardPage] Error fetching leaderboard:', error);
    fetchFailed = true;
  }

  return (
    <>
      {fetchFailed && <ErrorNotification title='Could not load leaderboard' message='Failed to reach the server. Please try again later.' />}
      <div className='min-h-screen bg-gray-950 py-20 px-6 sm:px-8 text-white selection:bg-indigo-500 selection:text-white'>
        <div className='max-w-5xl mx-auto'>
          <div className='mb-12 flex flex-col md:flex-row justify-between items-end gap-6'>
            <div className='space-y-4'>
              <Link href='/' className='group text-indigo-400 hover:text-indigo-300 mb-6 inline-flex items-center gap-2 font-semibold transition-colors'>
                <span className='group-hover:-translate-x-1 transition-transform'>←</span> Back to Home
              </Link>
              <h1 className='text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400'>Global Leaderboard</h1>
              <p className='text-lg text-gray-400'>The smartest minds on TrivioQ. Are you on the list?</p>
            </div>
          </div>

          <LeaderboardTabs initialData={leaderboardData} />
        </div>
      </div>
    </>
  );
}
