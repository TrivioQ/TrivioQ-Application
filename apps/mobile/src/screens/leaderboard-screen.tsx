import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  cumulativeScore: number;
  currentStreak: number;
}

// Podium configuration per rank
const PODIUM = [
  { rank: 1, emoji: '🥇', label: '1st', gradientTop: '#FBBF24', gradientBot: '#D97706', textColor: '#78350F', height: 110 },
  { rank: 2, emoji: '🥈', label: '2nd', gradientTop: '#CBD5E1', gradientBot: '#94A3B8', textColor: '#1E293B', height: 90 },
  { rank: 3, emoji: '🥉', label: '3rd', gradientTop: '#FB923C', gradientBot: '#C2410C', textColor: '#FFFFFF', height: 75 },
];

function PodiumCard({ entry, podium, isCurrentUser, colors }: { entry: LeaderboardEntry; podium: (typeof PODIUM)[0]; isCurrentUser: boolean; colors: ThemeColors }) {
  const name = entry.displayName ?? entry.username;
  return (
    <View style={[podiumCardStyle(podium.height, podium.gradientTop, colors, isCurrentUser)]}>
      <Text style={{ fontSize: 32, marginBottom: 4 }}>{podium.emoji}</Text>
      <Text style={[{ fontSize: 13, fontWeight: '800', color: podium.textColor, textAlign: 'center' }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: podium.textColor + 'CC', marginTop: 2 }}>{entry.cumulativeScore.toLocaleString()} pts</Text>
      {entry.currentStreak > 0 && <Text style={{ fontSize: 10, color: podium.textColor + 'AA', marginTop: 2 }}>🔥 {entry.currentStreak}d</Text>}
      <View
        style={{
          marginTop: 8,
          backgroundColor: podium.gradientBot + '55',
          borderRadius: radius.full,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '800', color: podium.textColor }}>{podium.label}</Text>
      </View>
    </View>
  );
}

function podiumCardStyle(height: number, bg: string, colors: ThemeColors, isCurrentUser: boolean) {
  return {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    backgroundColor: bg + '30',
    borderWidth: isCurrentUser ? 2 : 1,
    borderColor: isCurrentUser ? colors.brand : bg + '80',
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: height,
    marginHorizontal: 4,
  };
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { data, isLoading, error } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/leaderboard');
      return response.data;
    },
    enabled: !!userId,
  });

  const top3 = (data ?? []).filter((e) => e.rank <= 3);
  const rest = (data ?? []).filter((e) => e.rank > 3);

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.userId === userId;
    return (
      <View style={[styles.row, isCurrentUser && styles.rowHighlighted]}>
        <View style={[styles.rankBadge, { backgroundColor: colors.borderColor }]}>
          <Text style={styles.rankText}>#{item.rank}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.username, isCurrentUser && { color: colors.brand }]} numberOfLines={1}>
            {item.displayName ?? item.username}
            {isCurrentUser ? t('leaderboard.youSuffix') : ''}
          </Text>
          <Text style={styles.streak}>{t('leaderboard.dayStreak', { count: item.currentStreak })}</Text>
        </View>
        <Text style={styles.score}>{t('leaderboard.pts', { score: item.cumulativeScore.toLocaleString() })}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('leaderboard.error')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('leaderboard.title')}</Text>
      <Text style={styles.subheading}>{t('leaderboard.subtitle')}</Text>

      <FlatList
        data={rest}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          top3.length > 0 ? (
            <View style={styles.podiumSection}>
              {/* Arrange: 2nd, 1st, 3rd for visual podium layout */}
              {[top3.find((e) => e.rank === 2), top3.find((e) => e.rank === 1), top3.find((e) => e.rank === 3)].map((entry, i) => {
                if (!entry) return <View key={i} style={{ flex: 1, marginHorizontal: 4 }} />;
                const podium = PODIUM.find((p) => p.rank === entry.rank)!;
                return <PodiumCard key={entry.userId} entry={entry} podium={podium} isCurrentUser={entry.userId === userId} colors={colors} />;
              })}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏆</Text>
            <Text style={styles.emptyText}>{t('leaderboard.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      paddingTop: 16,
    },
    heading: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      paddingHorizontal: 20,
      marginBottom: 2,
    },
    subheading: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    podiumSection: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginHorizontal: 4,
      marginBottom: 20,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.md,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.borderColor,
      gap: 12,
    },
    rowHighlighted: {
      borderColor: colors.brand,
      backgroundColor: colors.brand + '10',
    },
    rankBadge: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    userInfo: {
      flex: 1,
    },
    username: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    streak: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    score: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.brand,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
  });
