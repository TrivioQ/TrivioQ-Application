import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  cumulativeScore: number;
  currentStreak: number;
}

function getRankBadge(rank: number, colors: ThemeColors) {
  if (rank === 1) return { label: '🥇', bg: '#fbbf24' };
  if (rank === 2) return { label: '🥈', bg: '#94a3b8' };
  if (rank === 3) return { label: '🥉', bg: '#cd7c3a' };
  return { label: `#${rank}`, bg: colors.bgSecondary };
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

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const badge = getRankBadge(item.rank, colors);
    const isCurrentUser = item.userId === userId;

    return (
      <View style={[styles.row, isCurrentUser && styles.rowHighlighted]}>
        <View style={[styles.rankBadge, { backgroundColor: badge.bg }]}>
          <Text style={styles.rankText}>{badge.label}</Text>
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
        data={data ?? []}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
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
    list: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.borderColor,
      gap: 12,
    },
    rowHighlighted: {
      borderColor: colors.brand,
      backgroundColor: 'rgba(99,102,241,0.1)',
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
      color: colors.textPrimary,
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
