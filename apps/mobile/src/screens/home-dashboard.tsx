import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import { QuestionDropPayload } from '@trivioq/shared-types';

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
    easy: '#27ae60',
    medium: '#f39c12',
    hard: '#e74c3c',
  };
  const diffColor = difficultyColors[drop.difficulty] ?? '#7f8c8d';

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
          {!isExpired && <Text style={styles.tapToAnswer}>Tap to answer →</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeDashboard({ navigation }: any) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);

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
          <ActivityIndicator size='small' color='#4c669f' />
          <Text style={styles.skeletonLabel}>Checking for active drop…</Text>
        </View>
      ) : activeDrop ? (
        <ActiveDropBanner drop={activeDrop} navigation={navigation} />
      ) : (
        <View style={styles.noDropBanner}>
          <Text style={styles.noDropIcon}>⏳</Text>
          <Text style={styles.noDropText}>No active question or drop</Text>
          <Text style={styles.noDropSub}>There is currently no active question for you. Questions are dropped automatically on your schedule — check back soon.</Text>
        </View>
      )}

      {/* Profile metrics */}
      {profileLoading ? (
        <ActivityIndicator size='large' color='#0000ff' style={styles.loader} />
      ) : profileError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load metrics</Text>
          <Button title='Retry' onPress={() => refetchProfile()} />
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
        <Button title={t('home.editPreferences')} onPress={() => navigation.navigate('Preferences')} />
        <View style={{ height: 15 }} />
        <Button title={onDemandMutation.isPending ? t('home.requesting') : t('home.requestNext')} onPress={() => onDemandMutation.mutate()} disabled={onDemandMutation.isPending} color='#9b59b6' />
      </View>

      <Modal visible={isPaywallVisible} animationType='slide' transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upgrade to Premium</Text>
            <Text style={styles.modalBody}>On-demand questions are a Premium feature. Upgrade to get up to 100 drops per day and request questions instantly, anytime.</Text>
            <TouchableOpacity
              style={styles.premiumButton}
              onPress={() => {
                setIsPaywallVisible(false);
                navigation.navigate('Profile');
              }}
            >
              <Text style={styles.premiumButtonText}>View Premium Plans</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsPaywallVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: '#999', fontSize: 14 }}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  activeBanner: {
    width: '100%',
    backgroundColor: '#eaf4ff',
    borderWidth: 1.5,
    borderColor: '#4c669f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  activeBannerExpired: {
    backgroundColor: '#fef2f2',
    borderColor: '#e74c3c',
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
    backgroundColor: '#4c669f',
    marginRight: 8,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2c3e50',
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
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  catBadge: {
    fontSize: 11,
    color: '#7f8c8d',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  ptsBadge: {
    fontSize: 11,
    color: '#4c669f',
    backgroundColor: 'rgba(76,102,159,0.1)',
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
    color: '#4c669f',
  },
  timerUrgent: {
    color: '#e67e22',
  },
  timerExpired: {
    color: '#e74c3c',
  },
  tapToAnswer: {
    fontSize: 10,
    color: '#4c669f',
    marginTop: 2,
  },
  bannerSkeleton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  skeletonLabel: {
    color: '#999',
    fontSize: 13,
  },
  noDropBanner: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    color: '#555',
    marginBottom: 6,
  },
  noDropSub: {
    fontSize: 12,
    color: '#999',
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
    color: 'red',
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
    backgroundColor: '#f8f9fa',
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
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#fff',
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
    color: '#8e44ad',
  },
  modalBody: {
    fontSize: 16,
    textAlign: 'center',
    color: '#34495e',
    marginBottom: 25,
    lineHeight: 24,
  },
  premiumButton: {
    backgroundColor: '#8e44ad',
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
