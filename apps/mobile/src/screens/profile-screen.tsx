import React, { useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useConfirm } from '../components/confirm-modal';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { NotificationBell } from '../components/notification-bell';

interface UserProfile {
  email: string;
  username: string;
  displayName: string | null;
  dateOfBirth: string | null;
  currentStreak: number;
  cumulativeScore: number;
  subscriptionTier: 'FREE' | 'PLUS' | 'PREMIUM';
}

function getInitials(displayName: string | null, email: string) {
  if (displayName) {
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

export default function ProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { userId, logout } = useAuth();
  const confirm = useConfirm();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { data, isLoading } = useQuery<UserProfile>({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me');
      return response.data;
    },
    enabled: !!userId,
  });

  // Set up header right with notification bell
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NotificationBell navigation={navigation} />,
    });
  }, [navigation]);

  const handleLogout = async () => {
    const ok = await confirm({
      title: t('profile.signOutAlertTitle'),
      message: t('profile.signOutAlertBody'),
      confirmLabel: t('profile.signOutConfirm'),
      cancelLabel: t('common.cancel'),
      isDestructive: true,
    });
    if (ok) logout();
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const initials = getInitials(data?.displayName ?? null, data?.email ?? '');
  const isPremium = data?.subscriptionTier === 'PREMIUM';
  const isPlus = data?.subscriptionTier === 'PLUS';
  const isPaid = isPremium || isPlus;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.displayName}>{data?.displayName ?? data?.username ?? '—'}</Text>
        <Text style={styles.email}>{data?.email}</Text>
        <View style={[styles.tierBadge, isPaid && styles.tierBadgePremium]}>
          <Text style={[styles.tierText, isPaid && styles.tierTextPremium]}>{isPremium ? t('profile.premiumTier') : isPlus ? t('profile.plusTier') : t('profile.freeTier')}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>🔥 {data?.currentStreak ?? 0}</Text>
          <Text style={styles.statLabel}>{t('profile.streak')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statValue}>⭐ {(data?.cumulativeScore ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>{t('profile.totalScore')}</Text>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.account')}</Text>
        {data?.dateOfBirth && (
          <View style={styles.infoItem}>
            <Text style={styles.menuIcon}>🎂</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{t('profile.dateOfBirth')}</Text>
              <Text style={styles.infoValue}>{data.dateOfBirth}</Text>
            </View>
          </View>
        )}
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => navigation.navigate('Preferences')}>
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.menuLabel}>{t('profile.preferences')}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={styles.menuLabel}>{t('profile.notifications')}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => navigation.navigate('ScoreHistory')}>
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={styles.menuLabel}>{t('profile.scoreHistory')}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.subscription')}</Text>
        <TouchableOpacity style={[styles.menuItem, styles.upgradeItem]} activeOpacity={0.7} onPress={() => navigation.navigate('Subscription')}>
          <Text style={styles.menuIcon}>👑</Text>
          <Text style={[styles.menuLabel, { color: '#a78bfa' }]}>{isPaid ? t('profile.manageSubscription') : t('profile.upgradePremium')}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.help')}</Text>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => navigation.navigate('FAQ')}>
          <Text style={styles.menuIcon}>❓</Text>
          <Text style={styles.menuLabel}>{t('profile.faq')}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.legal')}</Text>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => navigation.navigate('Terms')}>
          <Text style={styles.menuIcon}>📄</Text>
          <Text style={styles.menuLabel}>{t('profile.terms')}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => navigation.navigate('Privacy')}>
          <Text style={styles.menuIcon}>🔒</Text>
          <Text style={styles.menuLabel}>{t('profile.privacy')}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      paddingBottom: 40,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgPrimary,
    },

    // Avatar
    avatarSection: {
      alignItems: 'center',
      paddingTop: 32,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderColor,
      marginBottom: 8,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 8,
    },
    avatarText: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
    },
    displayName: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    email: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    tierBadge: {
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: colors.bgPrimary,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    tierBadgePremium: {
      backgroundColor: 'rgba(167,139,250,0.15)',
      borderColor: '#7c3aed',
    },
    tierText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tierTextPremium: {
      color: '#a78bfa',
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginVertical: 16,
      backgroundColor: colors.bgSecondary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
      overflow: 'hidden',
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 18,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.borderColor,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },

    // Menu sections
    section: {
      marginHorizontal: 20,
      marginTop: 16,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.brand,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      borderRadius: 14,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderColor,
      gap: 12,
    },
    upgradeItem: {
      borderColor: 'rgba(124,58,237,0.3)',
      backgroundColor: 'rgba(99,102,241,0.08)',
    },
    menuIcon: {
      fontSize: 18,
      width: 24,
      textAlign: 'center',
    },
    menuLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    menuChevron: {
      fontSize: 20,
      color: colors.textSecondary,
    },

    // DOB info row
    infoItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.bgSecondary,
      borderRadius: 14,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderColor,
      gap: 12,
    },
    infoTextContainer: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: colors.textSecondary,
      marginBottom: 2,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },

    // Logout
    logoutButton: {
      marginHorizontal: 20,
      marginTop: 28,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.error + '14',
      alignItems: 'center',
    },
    logoutText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.error,
    },
  });
