import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  cumulativeScore: number;
  currentStreak: number;
}

function getRankBadge(rank: number) {
  if (rank === 1) return { label: '🥇', bg: '#fbbf24' };
  if (rank === 2) return { label: '🥈', bg: '#94a3b8' };
  if (rank === 3) return { label: '🥉', bg: '#cd7c3a' };
  return { label: `#${rank}`, bg: '#1e293b' };
}

export default function LeaderboardScreen() {
  const { userId } = useAuth();

  const { data, isLoading, error } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/leaderboard');
      return response.data;
    },
    enabled: !!userId,
  });

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const badge = getRankBadge(item.rank);
    const isCurrentUser = item.userId === userId;

    return (
      <View style={[styles.row, isCurrentUser && styles.rowHighlighted]}>
        <View style={[styles.rankBadge, { backgroundColor: badge.bg }]}>
          <Text style={styles.rankText}>{badge.label}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.username, isCurrentUser && { color: '#818cf8' }]} numberOfLines={1}>
            {item.displayName ?? item.username}
            {isCurrentUser ? ' (You)' : ''}
          </Text>
          <Text style={styles.streak}>🔥 {item.currentStreak} day streak</Text>
        </View>
        <Text style={styles.score}>{item.cumulativeScore.toLocaleString()} pts</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size='large' color='#6366f1' />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load leaderboard.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Leaderboard</Text>
      <Text style={styles.subheading}>Global Rankings</Text>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No rankings yet. Start answering! 🏆</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  subheading: {
    fontSize: 13,
    color: '#64748b',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  rowHighlighted: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  streak: {
    fontSize: 12,
    color: '#94a3b8',
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818cf8',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
});
