import { cookies } from 'next/headers';
import { ErrorNotification } from '@/components/error-notification';
import { makeServerAPICallV1 } from '@/lib/api-server';
import { LeaderboardTabs } from '@/components/leaderboard-tabs';

export const revalidate = 60; // Revalidate the leaderboard every 60 seconds

interface LeaderboardUser {
  id: string;
  username: string;
  displayName: string | null;
  cumulativeScore: number;
  currentStreak: number;
  baseScore: number;
  bonusScore: number;
}

export default async function LeaderboardPage() {
  const isLoggedIn = !!cookies().get('tq_auth');

  let leaderboardData = {
    global: {
      weekly: [] as LeaderboardUser[],
      monthly: [] as LeaderboardUser[],
      alltime: [] as LeaderboardUser[],
    },
    friends: {
      weekly: [] as LeaderboardUser[],
      monthly: [] as LeaderboardUser[],
      alltime: [] as LeaderboardUser[],
    },
  };
  let fetchFailed = false;

  try {
    const fetchGlobal = Promise.all([makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/global?period=weekly'), makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/global?period=monthly'), makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/global?period=alltime')]);

    const fetchFriends = isLoggedIn ? Promise.all([makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/friends?period=weekly'), makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/friends?period=monthly'), makeServerAPICallV1<{ leaderboard: LeaderboardUser[] }>('leaderboards/friends?period=alltime')]) : Promise.resolve([null, null, null]);

    const [[gw, gm, ga], [fw, fm, fa]] = await Promise.all([fetchGlobal, fetchFriends]);

    leaderboardData.global = {
      weekly: gw.leaderboard ?? [],
      monthly: gm.leaderboard ?? [],
      alltime: ga.leaderboard ?? [],
    };

    if (isLoggedIn && fw && fm && fa) {
      leaderboardData.friends = {
        weekly: fw.leaderboard ?? [],
        monthly: fm.leaderboard ?? [],
        alltime: fa.leaderboard ?? [],
      };
    }
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
              <h1 className='text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400'>Leaderboard</h1>
              <p className='text-gray-400 mt-2'>See how you stack up against the best in the world and your friends.</p>
            </div>
          </div>

          {fetchFailed ? <ErrorNotification message='Failed to load leaderboard. Please try again later.' /> : <LeaderboardTabs initialData={leaderboardData} isLoggedIn={isLoggedIn} />}
        </div>
      </div>
    </>
  );
}
