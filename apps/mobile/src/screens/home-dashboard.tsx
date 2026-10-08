import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QuestionDropPayload } from '@trivioq/shared-types';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { NotificationBell } from '../components/notification-bell';
import { ProgressRing } from '../components/progress-ring';
import { ScoreTrendChart } from '../components/score-trend-chart';
import { SegmentedControl, Skeleton, StatCard } from '../components/ui';
import { api, queryKeys, useMe, useToday } from '../api/queries';
import apiClient from '../api/client';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** "in 2h 15m" / "in 5m" style relative label for an upcoming time. */
function formatUntil(iso: string, t: (key: string, options?: any) => string) {
  const mins = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? t('home.inHoursMinutes', { h, m }) : t('home.inMinutes', { m });
}

function getGreeting(name: string | undefined | null, t: (key: string, options?: any) => string) {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? t('home.greetingMorning') : hour < 17 ? t('home.greetingAfternoon') : t('home.greetingEvening');
  return name ? `${prefix}, ${name}` : prefix;
}

function ActiveDropBanner({ drop, navigation, colors, styles }: { drop: QuestionDropPayload; navigation: any; colors: ThemeColors; styles: any }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<number>(() => Math.max(0, Math.floor((drop.expiresAt - Date.now()) / 1000)));
  const [isExpired, setIsExpired] = useState(timeLeft === 0);

  useEffect(() => {
    if (isExpired) return;
    const id = setInterval(() => {
      const diff = Math.max(0, Math.floor((drop.expiresAt - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) {
        setIsExpired(true);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [drop.expiresAt, isExpired]);

  const difficultyColors: Record<string, string> = {
    easy: colors.success,
    medium: colors.warning,
    hard: colors.error,
  };
  const diffColor = difficultyColors[drop.difficulty] ?? colors.textSecondary;

  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${isExpired ? t('home.expiredDrop') : t('home.activeDrop')}. ${drop.difficulty}, ${drop.category}, ${drop.pointsValue} pts. ${formatTime(timeLeft)}`} accessibilityHint={t('home.tapToAnswer')} style={[styles.heroBanner, isExpired && styles.heroBannerExpired]} onPress={() => navigation.navigate('DropActive')} activeOpacity={0.88}>
      <View style={styles.heroStatusRow}>
        {!isExpired && <View style={styles.pulseDot} />}
        <Text style={styles.heroStatusText}>{isExpired ? t('home.expiredDrop') : t('home.activeDrop')}</Text>
      </View>

      <View style={styles.heroBadgesRow}>
        <Text style={[styles.diffBadge, { color: diffColor, borderColor: diffColor + '40', backgroundColor: diffColor + '18' }]}>{drop.difficulty.toUpperCase()}</Text>
        <Text style={styles.catBadge}>{drop.category}</Text>
        <Text style={styles.ptsBadge}>{drop.pointsValue} pts</Text>
      </View>

      <Text style={[styles.heroTimer, isExpired ? styles.timerExpired : timeLeft <= 60 ? styles.timerUrgent : styles.timerNormal]}>{formatTime(timeLeft)}</Text>
      {!isExpired && <Text style={styles.tapToAnswer}>{t('home.tapToAnswer')}</Text>}
    </TouchableOpacity>
  );
}

export default function HomeDashboard({ navigation }: any) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [trendMode, setTrendMode] = useState<'weekly' | 'monthly'>('weekly');
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NotificationBell navigation={navigation} />,
    });
  }, [navigation]);

  const onDemandMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/v1/drops/on-demand');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeDrop });
      queryClient.invalidateQueries({ queryKey: queryKeys.today });
      navigation.navigate('DropActive');
    },
    onError: (err: any) => {
      if (err.response?.data?.code === 'UPGRADE_REQUIRED') {
        setIsPaywallVisible(true);
      } else {
        console.error('Failed to request drop:', err.response?.data || err.message);
      }
    },
  });

  const { data: profileData, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useMe();
  const { data: today, refetch: refetchToday } = useToday();

  const {
    data: activeDrop,
    isLoading: dropLoading,
    refetch: refetchDrop,
  } = useQuery<QuestionDropPayload | null>({
    queryKey: [...queryKeys.activeDrop, userId],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/v1/drops/active');
        return response.status === 204 || !response.data ? null : (response.data as QuestionDropPayload);
      } catch (error: any) {
        if (error.response?.status === 404) return null;
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const { data: weekly = [], refetch: refetchWeekly } = useQuery({ queryKey: queryKeys.scoreHistory('weekly'), queryFn: () => api.scoreHistory('weekly'), enabled: !!userId });
  const { data: monthly = [], refetch: refetchMonthly } = useQuery({ queryKey: queryKeys.scoreHistory('monthly'), queryFn: () => api.scoreHistory('monthly'), enabled: !!userId });
  const { data: weekRank, refetch: refetchWeekRank } = useQuery({ queryKey: queryKeys.leaderboardMe('global', 'weekly'), queryFn: () => api.leaderboardMe('global', 'weekly'), enabled: !!userId });
  const { data: monthRank, refetch: refetchMonthRank } = useQuery({ queryKey: queryKeys.leaderboardMe('global', 'monthly'), queryFn: () => api.leaderboardMe('global', 'monthly'), enabled: !!userId });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetchProfile(), refetchToday(), refetchDrop(), refetchWeekly(), refetchMonthly(), refetchWeekRank(), refetchMonthRank()]);
    setRefreshing(false);
  }, [refetchProfile, refetchToday, refetchDrop, refetchWeekly, refetchMonthly, refetchWeekRank, refetchMonthRank]);

  const displayName = profileData?.displayName || profileData?.username;
  const currentWeek = weekly[0];
  const currentMonth = monthly[0];
  const accuracyPct = profileData && profileData.questionsAnswered > 0 ? Math.round((profileData.correctAnswers / profileData.questionsAnswered) * 100) : null;

  return (
    <View style={styles.outerContainer}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        <Text accessibilityRole="header" style={styles.greeting}>
          {getGreeting(displayName, t)}
        </Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

        {/* ── Streak at risk ── */}
        {today?.streakAtRisk && (
          <View accessibilityRole="alert" style={styles.riskBanner}>
            <Text style={styles.riskEmoji}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.riskTitle}>{t('home.streakAtRiskTitle', { count: today.currentStreak })}</Text>
              <Text style={styles.riskBody}>{new Date(today.windowEnd).getTime() > Date.now() ? t('home.streakAtRiskBody', { until: formatUntil(today.windowEnd, t) }) : t('home.streakAtRiskBodyLate')}</Text>
            </View>
          </View>
        )}

        {/* ── Active Drop Banner (hero) or useful empty state ── */}
        {dropLoading ? (
          <Skeleton height={150} rounded={radius.xl} style={{ marginBottom: 20 }} />
        ) : activeDrop ? (
          <ActiveDropBanner drop={activeDrop} navigation={navigation} colors={colors} styles={styles} />
        ) : (
          <View style={styles.noDropBanner}>
            <Text style={styles.noDropIcon}>⏳</Text>
            <Text style={styles.noDropText}>{t('home.noDropTitle')}</Text>
            <Text style={styles.noDropSub}>{today?.nextDropAt ? t('home.nextDropAt', { when: formatUntil(today.nextDropAt, t) }) : t('home.noDropSub')}</Text>
            {today?.lastResult && (
              <View style={styles.lastResultRow}>
                <Text style={styles.lastResultText}>
                  {today.lastResult.revealedAnswer ? '👁' : today.lastResult.wasCorrect ? '✅' : '❌'} {t('home.lastResult', { category: today.lastResult.category ?? '—', points: today.lastResult.pointsAwarded })}
                </Text>
              </View>
            )}
            {weekRank?.rank != null && (
              <Text style={styles.lastResultText}>
                {t('home.rankThisWeekShort', { rank: weekRank.rank })}
                {weekRank.pointsToNextRank ? ` · ${t('home.pointsToNext', { count: weekRank.pointsToNextRank })}` : ''}
              </Text>
            )}
          </View>
        )}

        {/* ── Today's progress ── */}
        {today && (
          <View style={styles.todayCard}>
            <ProgressRing value={today.answeredToday} max={Math.max(today.receivedToday, 1)} label={`${today.answeredToday}/${Math.max(today.receivedToday, today.answeredToday)}`} sublabel={t('home.answered')} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.todayTitle}>{t('home.todayTitle')}</Text>
              <Text style={styles.todayLine}>{t('home.todayAnswered', { answered: today.answeredToday, received: today.receivedToday })}</Text>
              <Text style={styles.todayLine}>{today.nextDropAt ? t('home.nextDropAt', { when: formatUntil(today.nextDropAt, t) }) : t('home.noMoreDropsToday')}</Text>
            </View>
          </View>
        )}

        {/* ── Stats ── */}
        {profileLoading ? (
          <View style={styles.statsGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width="47%" height={84} rounded={radius.lg} />
            ))}
          </View>
        ) : profileError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t('home.failedMetrics')}</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={() => refetchProfile()}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard label={t('home.weeklyScore')} value={(currentWeek?.totalScore ?? 0).toLocaleString()} sub={weekRank?.rank ? t('home.rankThisWeek', { rank: weekRank.rank }) : t('home.noRankYet')} />
            <StatCard label={t('home.monthlyScore')} value={(currentMonth?.totalScore ?? 0).toLocaleString()} sub={monthRank?.rank ? t('home.rankThisMonth', { rank: monthRank.rank }) : t('home.noRankYet')} />
            <StatCard label={t('home.streak')} value={`🔥 ${profileData?.currentStreak ?? 0}`} accent={today?.streakAtRisk ? colors.warning : undefined} />
            <StatCard label={t('home.totalScore')} value={`⭐ ${(profileData?.cumulativeScore ?? 0).toLocaleString()}`} />
            <StatCard label={t('home.accuracy')} value={accuracyPct !== null ? `${accuracyPct}%` : '—'} sub={t('home.accuracySub', { count: profileData?.questionsAnswered ?? 0 })} />
          </View>
        )}

        {/* ── Score trend ── */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{t('home.scoreTrend')}</Text>
            <SegmentedControl
              style={{ width: 170 }}
              value={trendMode}
              onChange={setTrendMode}
              options={[
                { value: 'weekly', label: t('scoreHistory.weekly') },
                { value: 'monthly', label: t('scoreHistory.monthly') },
              ]}
            />
          </View>
          <ScoreTrendChart data={trendMode === 'weekly' ? weekly : monthly} mode={trendMode} />
        </View>

        {/* ── Quick links ── */}
        <View style={styles.quickLinks}>
          <TouchableOpacity accessibilityRole="button" style={styles.preferencesButton} onPress={() => navigation.navigate('History', { screen: 'ReviewMistakes' })} activeOpacity={0.8}>
            <Text style={styles.preferencesButtonText}>🧠 {t('home.reviewMistakes')}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.preferencesButton} onPress={() => navigation.navigate('Profile', { screen: 'Preferences' })} activeOpacity={0.8}>
            <Text style={styles.preferencesButtonText}>⚙️ {t('home.editPreferences')}</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer so content doesn't sit under the FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Floating Action Button — Request Next Drop ── */}
      <View style={styles.fabContainer}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('home.requestNext')} accessibilityState={{ busy: onDemandMutation.isPending }} style={[styles.fab, onDemandMutation.isPending && styles.fabDisabled]} onPress={() => onDemandMutation.mutate()} disabled={onDemandMutation.isPending} activeOpacity={0.85}>
          {onDemandMutation.isPending ? <ActivityIndicator color={colors.onAccent} size="small" /> : <Text style={styles.fabText}>⚡ {t('home.requestNext')}</Text>}
        </TouchableOpacity>
      </View>

      {/* Paywall Modal */}
      <Modal visible={isPaywallVisible} animationType="slide" transparent={true} onRequestClose={() => setIsPaywallVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              {t('home.paywallTitle')}
            </Text>
            <Text style={styles.modalBody}>{t('home.paywallBody')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.premiumButton}
              onPress={() => {
                setIsPaywallVisible(false);
                navigation.navigate('Profile', { screen: 'Subscription' });
              }}
            >
              <Text style={styles.premiumButtonText}>{t('home.paywallCta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => setIsPaywallVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('home.paywallDismiss')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 28,
    },

    // Greeting
    greeting: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 24,
    },

    // Hero drop banner
    heroBanner: {
      width: '100%',
      backgroundColor: colors.brand + '12',
      borderWidth: 2,
      borderColor: colors.brand,
      borderRadius: radius.xl,
      padding: 20,
      marginBottom: 20,
    },
    heroBannerExpired: {
      borderColor: colors.error,
      backgroundColor: colors.error + '10',
    },
    heroStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    pulseDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.brand,
    },
    heroStatusText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.brand,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    heroBadgesRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    diffBadge: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    catBadge: {
      fontSize: 11,
      color: colors.textSecondary,
      backgroundColor: colors.borderColor,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    ptsBadge: {
      fontSize: 11,
      color: colors.brand,
      backgroundColor: colors.brand + '18',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    heroTimer: {
      fontSize: 48,
      fontWeight: 'bold',
      fontVariant: ['tabular-nums'],
      marginBottom: 4,
    },
    timerNormal: { color: colors.brand },
    timerUrgent: { color: colors.warning },
    timerExpired: { color: colors.error },
    tapToAnswer: {
      fontSize: 13,
      color: colors.brand,
      fontWeight: '600',
    },

    // No-drop / skeleton banners
    bannerSkeleton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.lg,
      padding: 18,
      marginBottom: 20,
    },
    skeletonLabel: { color: colors.textSecondary, fontSize: 14 },
    noDropBanner: {
      width: '100%',
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderRadius: radius.lg,
      padding: 24,
      marginBottom: 20,
      alignItems: 'center',
    },
    noDropIcon: { fontSize: 36, marginBottom: 10 },
    noDropText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    noDropSub: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },

    // Stats strip
    statsStrip: {
      flexDirection: 'row',
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderColor,
      marginBottom: 16,
      overflow: 'hidden',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 18,
    },
    statEmoji: { fontSize: 22, marginBottom: 4 },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.borderColor,
    },

    // Streak at risk
    riskBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.warning + '18',
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: radius.lg,
      padding: 14,
      marginBottom: 16,
    },
    riskEmoji: { fontSize: 28 },
    riskTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    riskBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

    // Empty state extras
    lastResultRow: { marginTop: 12 },
    lastResultText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', marginTop: 6, textAlign: 'center' },

    // Today card
    todayCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderColor,
      padding: 16,
      marginBottom: 16,
    },
    todayTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    todayLine: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

    // Stats grid
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },

    // Chart
    chartCard: {
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderColor,
      padding: 16,
      marginBottom: 16,
    },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
    chartTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },

    quickLinks: { gap: 8 },

    // Preferences outline button
    preferencesButton: {
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderRadius: radius.md,
      padding: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    preferencesButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    // FAB
    fabContainer: {
      position: 'absolute',
      bottom: 32,
      left: 20,
      right: 20,
    },
    fab: {
      backgroundColor: colors.brand,
      borderRadius: radius.pill,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 10,
    },
    fabDisabled: { opacity: 0.6 },
    fabText: {
      color: colors.onAccent,
      fontSize: 17,
      fontWeight: '800',
    },

    // Error state
    loader: { marginVertical: 30 },
    errorContainer: { alignItems: 'center', marginVertical: 30 },
    errorText: { color: colors.error, marginBottom: 12, fontSize: 14 },
    retryButton: {
      backgroundColor: colors.brand,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 24,
    },
    retryButtonText: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },

    // Paywall modal
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '88%',
      backgroundColor: colors.bgSecondary,
      padding: 30,
      borderRadius: radius.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.brandSoft,
      shadowColor: colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 12,
      color: colors.brand,
    },
    modalBody: {
      fontSize: 15,
      textAlign: 'center',
      color: colors.textPrimary,
      marginBottom: 24,
      lineHeight: 22,
    },
    premiumButton: {
      backgroundColor: colors.brand,
      paddingVertical: 14,
      paddingHorizontal: 30,
      borderRadius: radius.pill,
      width: '100%',
    },
    premiumButtonText: {
      color: colors.onAccent,
      fontSize: 17,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });
