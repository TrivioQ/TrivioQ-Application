import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import { QuestionDropPayload } from '@trivioq/shared-types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { NotificationBell } from '../components/notification-bell';

import apiClient from '../api/client';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function ActiveDropBanner({ drop, navigation }: { drop: QuestionDropPayload; navigation: any }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
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
    <TouchableOpacity style={[styles.activeBanner, isExpired && styles.activeBannerExpired]} onPress={() => navigation.navigate('DropActive')} activeOpacity={0.85}>
      <View style={styles.bannerRow}>
        <View style={styles.bannerLeft}>
          {!isExpired && <View style={styles.pulseDot} />}
          <View>
            <Text style={styles.bannerTitle}>{isExpired ? t('home.expiredDrop') : t('home.activeDrop')}</Text>
            <View style={styles.bannerBadgesRow}>
              <Text style={[styles.diffBadge, { color: diffColor }]}>{drop.difficulty.toUpperCase()}</Text>
              <Text style={styles.catBadge}>{drop.category}</Text>
              <Text style={styles.ptsBadge}>{drop.pointsValue} pts</Text>
            </View>
          </View>
        </View>
        <View style={styles.bannerRight}>
          <Text style={[styles.timerText, isExpired ? styles.timerExpired : timeLeft <= 60 ? styles.timerUrgent : styles.timerNormal]}>{formatTime(timeLeft)}</Text>
          {!isExpired && <Text style={styles.tapToAnswer}>{t('home.tapToAnswer')}</Text>}
        </View>
      </View>
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

  // Set up header right with notification bell
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <NotificationBell navigation={navigation} />
      ),
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.welcome')}</Text>
      <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

      {/* Active Drop Banner */}
      {dropLoading ? (
        <View style={styles.bannerSkeleton}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={styles.skeletonLabel}>{t('home.checkingDrop')}</Text>
        </View>
      ) : activeDrop ? (
        <ActiveDropBanner drop={activeDrop} navigation={navigation} />
      ) : (
        <View style={styles.noDropBanner}>
          <Text style={styles.noDropIcon}>⏳</Text>
          <Text style={styles.noDropText}>{t('home.noDropTitle')}</Text>
          <Text style={styles.noDropSub}>{t('home.noDropSub')}</Text>
        </View>
      )}

      {/* Profile metrics */}
      {profileLoading ? (
        <ActivityIndicator size="large" color={colors.brand} style={styles.loader} />
      ) : profileError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('home.failedMetrics')}</Text>
          <Button title={t('common.retry')} onPress={() => refetchProfile()} />
        </View>
      ) : (
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>🔥 {profileData.currentStreak}</Text>
            <Text style={styles.metricLabel}>{t('home.streak')}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>🏆 {profileData.cumulativeScore}</Text>
            <Text style={styles.metricLabel}>{t('home.totalScore')}</Text>
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button title={t('home.editPreferences')} onPress={() => navigation.navigate('Preferences')} color={colors.brand} />
        <View style={{ height: 15 }} />
        <Button title={onDemandMutation.isPending ? t('home.requesting') : t('home.requestNext')} onPress={() => onDemandMutation.mutate()} disabled={onDemandMutation.isPending} color={colors.brand} />
      </View>

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
    container: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.bgPrimary,
      padding: 20,
      paddingTop: 50,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 5,
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    activeBanner: {
      width: '100%',
      backgroundColor: colors.bgSecondary,
      borderWidth: 1.5,
      borderColor: colors.brand,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    activeBannerExpired: {
      backgroundColor: colors.bgSecondary,
      borderColor: colors.error,
    },
    bannerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    pulseDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.brand,
      marginRight: 8,
    },
    bannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    bannerBadgesRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    diffBadge: {
      fontSize: 11,
      fontWeight: '700',
      backgroundColor: colors.borderColor,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 20,
    },
    catBadge: {
      fontSize: 11,
      color: colors.textSecondary,
      backgroundColor: colors.borderColor,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 20,
    },
    ptsBadge: {
      fontSize: 11,
      color: colors.brand,
      backgroundColor: 'rgba(99,102,241,0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 20,
    },
    bannerRight: {
      alignItems: 'flex-end',
      marginLeft: 12,
    },
    timerText: {
      fontSize: 26,
      fontWeight: 'bold',
      fontVariant: ['tabular-nums'],
    },
    timerNormal: {
      color: colors.brand,
    },
    timerUrgent: {
      color: colors.warning,
    },
    timerExpired: {
      color: colors.error,
    },
    tapToAnswer: {
      fontSize: 10,
      color: colors.brand,
      marginTop: 2,
    },
    bannerSkeleton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bgSecondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    skeletonLabel: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    noDropBanner: {
      width: '100%',
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      alignItems: 'center',
    },
    noDropIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    noDropText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    noDropSub: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    loader: {
      marginVertical: 40,
    },
    errorContainer: {
      alignItems: 'center',
      marginVertical: 40,
    },
    errorText: {
      color: colors.error,
      marginBottom: 10,
    },
    metricsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 10,
      marginBottom: 50,
    },
    metricCard: {
      backgroundColor: colors.bgSecondary,
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      width: '45%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 8,
      color: colors.textPrimary,
    },
    metricLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    buttonContainer: {
      width: '80%',
      marginTop: 'auto',
      marginBottom: 40,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '85%',
      backgroundColor: colors.bgPrimary,
      padding: 30,
      borderRadius: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 15,
      color: colors.brand,
    },
    modalBody: {
      fontSize: 16,
      textAlign: 'center',
      color: colors.textPrimary,
      marginBottom: 25,
      lineHeight: 24,
    },
    premiumButton: {
      backgroundColor: colors.brand,
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 25,
      width: '100%',
    },
    premiumButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });
