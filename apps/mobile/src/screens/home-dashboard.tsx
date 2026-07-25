import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import { QuestionDropPayload } from '@trivioq/shared-types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { NotificationBell } from '../components/notification-bell';
import apiClient from '../api/client';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getGreeting(name: string | undefined | null) {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? '☀️ Good morning' : hour < 17 ? '👋 Good afternoon' : '🌙 Good evening';
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
    <TouchableOpacity style={[styles.heroBanner, isExpired && styles.heroBannerExpired]} onPress={() => navigation.navigate('DropActive')} activeOpacity={0.88}>
      {/* Status row */}
      <View style={styles.heroStatusRow}>
        {!isExpired && <View style={styles.pulseDot} />}
        <Text style={styles.heroStatusText}>{isExpired ? t('home.expiredDrop') : t('home.activeDrop')}</Text>
      </View>

      {/* Badges row */}
      <View style={styles.heroBadgesRow}>
        <Text style={[styles.diffBadge, { color: diffColor, borderColor: diffColor + '40', backgroundColor: diffColor + '18' }]}>{drop.difficulty.toUpperCase()}</Text>
        <Text style={styles.catBadge}>{drop.category}</Text>
        <Text style={styles.ptsBadge}>{drop.pointsValue} pts</Text>
      </View>

      {/* Timer */}
      <Text style={[styles.heroTimer, isExpired ? styles.timerExpired : timeLeft <= 60 ? styles.timerUrgent : styles.timerNormal]}>{formatTime(timeLeft)}</Text>
      {!isExpired && <Text style={styles.tapToAnswer}>{t('home.tapToAnswer')} →</Text>}
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NotificationBell navigation={navigation} />,
    });
  }, [navigation]);

  const onDemandMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/v1/drops/on-demand');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeDrop'] });
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

  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['userMe', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me');
      return response.data;
    },
  });

  const { data: activeDrop, isLoading: dropLoading } = useQuery<QuestionDropPayload | null>({
    queryKey: ['activeDrop', userId],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/api/v1/drops/active');
        return response.data as QuestionDropPayload;
      } catch (error: any) {
        if (error.response?.status === 404) return null;
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const displayName = profileData?.displayName || profileData?.username;

  return (
    <View style={styles.outerContainer}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Greeting ── */}
        <Text style={styles.greeting}>{getGreeting(displayName)}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

        {/* ── Active Drop Banner (hero) ── */}
        {dropLoading ? (
          <View style={styles.bannerSkeleton}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.skeletonLabel}>{t('home.checkingDrop')}</Text>
          </View>
        ) : activeDrop ? (
          <ActiveDropBanner drop={activeDrop} navigation={navigation} colors={colors} styles={styles} />
        ) : (
          <View style={styles.noDropBanner}>
            <Text style={styles.noDropIcon}>⏳</Text>
            <Text style={styles.noDropText}>{t('home.noDropTitle')}</Text>
            <Text style={styles.noDropSub}>{t('home.noDropSub')}</Text>
          </View>
        )}

        {/* ── Stats strip ── */}
        {profileLoading ? (
          <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
        ) : profileError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t('home.failedMetrics')}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetchProfile()}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statValue}>{profileData?.currentStreak ?? 0}</Text>
              <Text style={styles.statLabel}>{t('home.streak')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statValue}>{(profileData?.cumulativeScore ?? 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>{t('home.totalScore')}</Text>
            </View>
          </View>
        )}

        {/* ── Preferences quick link ── */}
        <TouchableOpacity style={styles.preferencesButton} onPress={() => navigation.navigate('Preferences')} activeOpacity={0.8}>
          <Text style={styles.preferencesButtonText}>⚙️ {t('home.editPreferences')}</Text>
        </TouchableOpacity>

        {/* Spacer so content doesn't sit under the FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Floating Action Button — Request Next Drop ── */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, onDemandMutation.isPending && styles.fabDisabled]} onPress={() => onDemandMutation.mutate()} disabled={onDemandMutation.isPending} activeOpacity={0.85}>
          {onDemandMutation.isPending ? <ActivityIndicator color={colors.onAccent} size="small" /> : <Text style={styles.fabText}>⚡ {t('home.requestNext')}</Text>}
        </TouchableOpacity>
      </View>

      {/* Paywall Modal */}
      <Modal visible={isPaywallVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('home.paywallTitle')}</Text>
            <Text style={styles.modalBody}>{t('home.paywallBody')}</Text>
            <TouchableOpacity
              style={styles.premiumButton}
              onPress={() => {
                setIsPaywallVisible(false);
                navigation.navigate('Profile');
              }}
            >
              <Text style={styles.premiumButtonText}>{t('home.paywallCta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsPaywallVisible(false)} style={{ marginTop: 12 }}>
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
