'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trophy, Target, Flame, Activity } from 'lucide-react';
import { UserModal } from '@/components/users-table/user-modal';
import { UserRow } from '@/components/users-table/columns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface UserStatsClientProps {
  user: any; // Using any for simplicity, it conforms to UserRow and more
  weeklyScore: any;
  monthlyScore: any;
  competitionsWon: number;
  accuracyByCategory: Array<{ name: string; accuracy: number; total: number }>;
}

export function UserStatsClient({ user, weeklyScore, monthlyScore, competitionsWon, accuracyByCategory }: UserStatsClientProps) {
  const [editOpen, setEditOpen] = useState(false);

  // Overall accuracy
  const totalCorrect = user.correctAnswers || 0;
  const totalAnswered = user.questionsAnswered || 0;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <div className="space-y-6">
      <UserModal user={user as UserRow} open={editOpen} onOpenChange={setEditOpen} />

      {/* Header Profile Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold uppercase">
              {user.username.substring(0, 2)}
            </div>
            <div>
              <CardTitle className="text-2xl">{user.displayName || user.username}</CardTitle>
              <CardDescription className="text-base">{user.email}</CardDescription>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.subscriptionTier === 'PREMIUM' ? 'bg-amber-100 text-amber-800' : user.subscriptionTier === 'PLUS' ? 'bg-purple-100 text-purple-800' : 'bg-muted text-muted-foreground'}`}>
                  {user.subscriptionTier}
                </span>
                <span className="text-xs text-muted-foreground">Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</span>
              </div>
            </div>
          </div>
          <Button onClick={() => setEditOpen(true)} variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Edit User
          </Button>
        </CardHeader>
      </Card>

      {/* High-Level Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.cumulativeScore || user.points || 0}</div>
            <p className="text-xs text-muted-foreground">Lifetime points earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.currentStreak || 0}</div>
            <p className="text-xs text-muted-foreground">Consecutive days active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions Answered</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnswered}</div>
            <p className="text-xs text-muted-foreground">{totalCorrect} correct answers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallAccuracy}%</div>
            <p className="text-xs text-muted-foreground">Average across all drops</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Leaderboard Performance */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Leaderboard Performance</CardTitle>
            <CardDescription>Recent rankings and wins</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium text-muted-foreground">This Week</span>
              <span className="font-bold text-lg">{weeklyScore?.rank ? `#${weeklyScore.rank}` : 'Unranked'}</span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <span className="font-medium text-muted-foreground">This Month</span>
              <span className="font-bold text-lg">{monthlyScore?.rank ? `#${monthlyScore.rank}` : 'Unranked'}</span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg bg-primary/5">
              <span className="font-medium text-primary">Competitions Won</span>
              <span className="font-bold text-lg text-primary">{competitionsWon}</span>
            </div>
          </CardContent>
        </Card>

        {/* Accuracy by Category Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Accuracy by Category</CardTitle>
            <CardDescription>Performance in top categories</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {accuracyByCategory && accuracyByCategory.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accuracyByCategory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} tickMargin={10} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, 'Accuracy']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="accuracy" fill="var(--color-primary, #3b82f6)" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                No category data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
