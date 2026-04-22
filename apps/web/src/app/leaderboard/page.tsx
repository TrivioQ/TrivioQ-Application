import { prisma } from '@trivioq/database';
import Link from 'next/link';

export const revalidate = 60; // Revalidate the leaderboard every 60 seconds

export default async function LeaderboardPage() {
  // Server Component directly querying Prisma database
  const topUsers = await prisma.user.findMany({
    take: 100,
    orderBy: {
      cumulativeScore: 'desc',
    },
    select: {
      id: true,
      username: true,
      cumulativeScore: true,
      currentStreak: true,
    },
  });

  return (
    <div className='min-h-screen bg-gray-950 py-20 px-6 sm:px-8 text-white selection:bg-indigo-500 selection:text-white'>
      <div className='max-w-5xl mx-auto'>
        <div className='mb-12 flex flex-col md:flex-row justify-between items-end gap-6'>
          <div>
            <Link href='/' className='group text-indigo-400 hover:text-indigo-300 mb-6 inline-flex items-center gap-2 font-semibold transition-colors'>
              <span className='group-hover:-translate-x-1 transition-transform'>←</span> Back to Home
            </Link>
            <h1 className='text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400'>Global Leaderboard</h1>
            <p className='mt-4 text-lg text-gray-400'>The smartest minds on Trivioq. Are you on the list?</p>
          </div>
          <div className='bg-gray-900 rounded-2xl px-8 py-5 shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10'>
            <span className='text-gray-500 text-xs uppercase font-extrabold tracking-widest block mb-1'>Top Players</span>
            <span className='text-3xl font-bold text-white'>{topUsers.length}</span>
          </div>
        </div>

        <div className='overflow-hidden rounded-2xl bg-gray-900 border border-white/10 shadow-2xl'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm whitespace-nowrap'>
              <thead className='bg-black/40 uppercase tracking-wider text-gray-400 text-xs font-bold border-b border-white/5'>
                <tr>
                  <th scope='col' className='px-8 py-6'>
                    Rank
                  </th>
                  <th scope='col' className='px-8 py-6'>
                    Player
                  </th>
                  <th scope='col' className='px-8 py-6 text-right'>
                    Current Streak
                  </th>
                  <th scope='col' className='px-8 py-6 text-right'>
                    Total Score
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-white/5'>
                {topUsers.map((user, index) => {
                  let rankClass = 'text-gray-400 font-medium';
                  let rowClass = 'hover:bg-white/[0.02] transition-colors';

                  if (index === 0) {
                    rankClass = 'text-yellow-400 font-bold text-xl drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]';
                    rowClass = 'bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors border-l-4 border-l-yellow-400';
                  } else if (index === 1) {
                    rankClass = 'text-gray-300 font-bold text-xl';
                    rowClass = 'bg-gray-500/10 hover:bg-gray-500/20 transition-colors border-l-4 border-l-gray-400';
                  } else if (index === 2) {
                    rankClass = 'text-amber-600 font-bold text-xl';
                    rowClass = 'bg-amber-700/10 hover:bg-amber-700/20 transition-colors border-l-4 border-l-amber-600';
                  } else {
                    rowClass += ' border-l-4 border-l-transparent';
                  }

                  return (
                    <tr key={user.id} className={rowClass}>
                      <td className={`px-8 py-5 ${rankClass} w-24`}>{index === 0 ? '🏆 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}</td>
                      <td className='px-8 py-5 font-medium text-white flex items-center gap-4 text-base'>
                        <div className='h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border border-white/10'>
                          <span className='text-sm font-bold tracking-wider'>{user.username.substring(0, 2).toUpperCase()}</span>
                        </div>
                        {user.username}
                      </td>
                      <td className='px-8 py-5 text-right w-32'>
                        <span className='inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]'>🔥 {user.currentStreak}</span>
                      </td>
                      <td className='px-8 py-5 text-right font-bold text-indigo-300 text-lg w-40'>{user.cumulativeScore.toLocaleString()}</td>
                    </tr>
                  );
                })}

                {topUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className='px-8 py-16 text-center text-gray-400 text-lg'>
                      No players found on the leaderboard yet. Check back soon!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
