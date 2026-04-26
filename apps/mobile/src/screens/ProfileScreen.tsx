import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

interface UserProfile {
  email: string;
  username: string;
  displayName: string | null;
  currentStreak: number;
  cumulativeScore: number;
  subscriptionTier: 'FREE' | 'PREMIUM';
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

export default function ProfileScreen() {
  const { userId, logout } = useAuth();

  const { data, isLoading } = useQuery<UserProfile>({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me');
      return response.data;
    },
    enabled: !!userId,
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size='large' color='#6366f1' />
      </View>
    );
  }

  const initials = getInitials(data?.displayName ?? null, data?.email ?? '');
  const isPremium = data?.subscriptionTier === 'PREMIUM';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.displayName}>{data?.displayName ?? data?.username ?? '—'}</Text>
        <Text style={styles.email}>{data?.email}</Text>
        <View style={[styles.tierBadge, isPremium && styles.tierBadgePremium]}>
          <Text style={[styles.tierText, isPremium && styles.tierTextPremium]}>{isPremium ? '⭐ Premium' : '🆓 Free Tier'}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>🔥 {data?.currentStreak ?? 0}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statValue}>⭐ {(data?.cumulativeScore ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Score</Text>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        {[
          { icon: '⚙️', label: 'Preferences' },
          { icon: '🔔', label: 'Notifications' },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Subscription</Text>
        <TouchableOpacity style={[styles.menuItem, styles.upgradeItem]} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>👑</Text>
          <Text style={[styles.menuLabel, { color: '#a78bfa' }]}>{isPremium ? 'Manage Subscription' : 'Upgrade to Premium'}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>🚪 Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#6366f1',
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
    color: '#f1f5f9',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  tierBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tierBadgePremium: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: '#7c3aed',
  },
  tierText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tierTextPremium: {
    color: '#a78bfa',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
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
    color: '#6366f1',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    color: '#cbd5e1',
  },
  menuChevron: {
    fontSize: 20,
    color: '#475569',
  },

  // Logout
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 28,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f87171',
  },
});
