import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { LeaderboardEntry } from '@trivioq/shared-types';
import { api, queryKeys, useMe } from '../api/queries';
import { SegmentedControl, SkeletonList } from '../components/ui';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';

// Podium configuration per rank
const PODIUM = [
  { rank: 1, emoji: '🥇', label: '1st', gradientTop: '#FBBF24', gradientBot: '#D97706', textColor: '#78350F', height: 110 },
  { rank: 2, emoji: '🥈', label: '2nd', gradientTop: '#CBD5E1', gradientBot: '#94A3B8', textColor: '#1E293B', height: 90 },
  { rank: 3, emoji: '🥉', label: '3rd', gradientTop: '#FB923C', gradientBot: '#C2410C', textColor: '#FFFFFF', height: 75 },
];

function PodiumCard({ entry, podium, isCurrentUser, colors }: { entry: LeaderboardEntry; podium: (typeof PODIUM)[0]; isCurrentUser: boolean; colors: ThemeColors }) {
  const name = entry.displayName ?? entry.username;
  return (
    <View accessible accessibilityLabel={`${podium.label}, ${name}, ${entry.cumulativeScore} pts`} style={[podiumCardStyle(podium.height, podium.gradientTop, colors, isCurrentUser)]}>
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

type Period = 'weekly' | 'monthly' | 'alltime';
type Scope = 'global' | 'friends';

export default function LeaderboardScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [period, setPeriod] = useState<Period>('weekly');
  const [scope, setScope] = useState<Scope>('global');
  const [refreshing, setRefreshing] = useState(false);
  const { data: me } = useMe();

  const { data, isLoading, error, refetch } = useQuery<LeaderboardEntry[]>({
    queryKey: queryKeys.leaderboard(scope, period),
    queryFn: () => api.leaderboard(scope, period),
    enabled: !!me,
  });

  const { data: myPosition, refetch: refetchMine } = useQuery({
    queryKey: queryKeys.leaderboardMe(scope, period),
    queryFn: () => api.leaderboardMe(scope, period),
    enabled: !!me,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetch(), refetchMine()]);
    setRefreshing(false);
  }, [refetch, refetchMine]);

  const entries = data ?? [];
  const top3 = entries.filter((e) => e.rank <= 3);
  const rest = entries.filter((e) => e.rank > 3);
  const meVisible = !!me && entries.some((e) => e.id === me.id);

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.id === me?.id;
    const name = item.displayName ?? item.username;
    return (
      <View accessible accessibilityLabel={`${t('leaderboard.rankA11y', { rank: item.rank })}, ${name}${isCurrentUser ? t('leaderboard.youSuffix') : ''}, ${t('leaderboard.pts', { score: item.cumulativeScore.toLocaleString() })}`} style={[styles.row, isCurrentUser && styles.rowHighlighted]}>
        <View style={[styles.rankBadge, { backgroundColor: colors.borderColor }]}>
          <Text style={styles.rankText}>#{item.rank}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.username, isCurrentUser && { color: colors.brand }]} numberOfLines={1}>
            {name}
            {isCurrentUser ? t('leaderboard.youSuffix') : ''}
          </Text>
          <Text style={styles.streak}>{t('leaderboard.dayStreak', { count: item.currentStreak })}</Text>
        </View>
        <Text style={styles.score}>{t('leaderboard.pts', { score: item.cumulativeScore.toLocaleString() })}</Text>
      </View>
    );
  };

  const header = (
    <View>
      <View style={styles.controls}>
        <SegmentedControl
          value={scope}
          onChange={setScope}
          options={[
            { value: 'global', label: t('leaderboard.global') },
            { value: 'friends', label: t('leaderboard.friends') },
          ]}
        />
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'weekly', label: t('leaderboard.weekly') },
            { value: 'monthly', label: t('leaderboard.monthly') },
            { value: 'alltime', label: t('leaderboard.allTime') },
          ]}
        />
      </View>
      {top3.length > 0 && (
        <View style={styles.podiumSection}>
          {/* Arrange: 2nd, 1st, 3rd for visual podium layout */}
          {[top3.find((e) => e.rank === 2), top3.find((e) => e.rank === 1), top3.find((e) => e.rank === 3)].map((entry, i) => {
            if (!entry) return <View key={i} style={{ flex: 1, marginHorizontal: 4 }} />;
            const podium = PODIUM.find((p) => p.rank === entry.rank)!;
            return <PodiumCard key={entry.id} entry={entry} podium={podium} isCurrentUser={entry.id === me?.id} colors={colors} />;
          })}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('leaderboard.title')}
      </Text>
      <Text style={styles.subheading}>{scope === 'friends' ? t('leaderboard.friendsSubtitle') : t('leaderboard.subtitle')}</Text>

      {isLoading || !me ? (
        <SkeletonList count={6} itemHeight={64} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('leaderboard.error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={
            top3.length === 0 ? (
              <View style={styles.centered}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>{scope === 'friends' ? '👥' : '🏆'}</Text>
                <Text style={styles.emptyText}>{scope === 'friends' ? t('leaderboard.friendsEmpty') : t('leaderboard.empty')}</Text>
                {scope === 'friends' && (
                  <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Friends')} style={styles.retryButton}>
                    <Text style={styles.retryText}>{t('leaderboard.addFriends')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* Pinned "your position" row when you're outside the visible list */}
      {!isLoading && me && !meVisible && myPosition && (
        <View accessible accessibilityLabel={myPosition.rank ? `${t('leaderboard.yourPosition')}: ${t('leaderboard.rankA11y', { rank: myPosition.rank })}` : t('leaderboard.notRanked')} style={styles.pinnedRow}>
          <View style={[styles.rankBadge, { backgroundColor: colors.brandFaint }]}>
            <Text style={[styles.rankText, { color: colors.brand }]}>{myPosition.rank ? `#${myPosition.rank}` : '—'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.username, { color: colors.brand }]}>{t('leaderboard.yourPosition')}</Text>
            <Text style={styles.streak}>{myPosition.rank ? (myPosition.pointsToNextRank ? t('leaderboard.pointsToNext', { count: myPosition.pointsToNextRank }) : t('leaderboard.youLead')) : t('leaderboard.notRanked')}</Text>
          </View>
          <Text style={styles.score}>{t('leaderboard.pts', { score: myPosition.score.toLocaleString() })}</Text>
        </View>
      )}
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
    controls: {
      gap: 10,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    pinnedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 2,
      borderTopColor: colors.brand,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    retryButton: {
      marginTop: 14,
      backgroundColor: colors.brand,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    retryText: {
      color: colors.onAccent,
      fontWeight: '700',
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
