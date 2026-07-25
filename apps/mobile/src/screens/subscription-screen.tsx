import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useToast } from '../components/toast';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'PREMIUM' | 'PLUS' | 'FREE';

interface SubscriptionData {
  currentStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  onDemandTokensAvailable: number;
  userTimezone: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} activeOpacity={0.7}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} activeOpacity={0.7}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [daysToActivate, setDaysToActivate] = useState(1);
  const [activating, setActivating] = useState(false);

  const { data, isLoading, isError } = useQuery<SubscriptionData>({
    queryKey: ['subscriptionStatus'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/subscriptions/status');
      return res.data;
    },
  });

  const handleActivate = useCallback(async () => {
    if (!data || daysToActivate < 1) return;
    setActivating(true);
    try {
      await apiClient.post('/api/v1/subscriptions/activate-vault', { daysToActivate });
      toast({ message: `✅ ${daysToActivate} premium day${daysToActivate > 1 ? 's' : ''} activated!`, type: 'success' });
      setDaysToActivate(1);
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    } catch {
      toast({ message: 'Failed to activate days. Please try again.', type: 'error' });
    } finally {
      setActivating(false);
    }
  }, [data, daysToActivate, toast, queryClient]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load subscription details.</Text>
      </View>
    );
  }

  const { currentStatus, subscriptionExpiresAt, onDemandTokensAvailable } = data;
  const isAutoRenew = currentStatus === 'PREMIUM';
  const isVault = currentStatus === 'PLUS';
  const isFree = currentStatus === 'FREE';
  const canActivate = isFree || isVault;
  const stepMin = onDemandTokensAvailable > 0 ? 1 : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Current Plan Card ────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Current Plan</Text>

        {isAutoRenew && (
          <>
            <View style={[styles.badge, styles.badgeGold]}>
              <Text style={[styles.badgeText, styles.badgeTextGold]}>👑 Premium</Text>
            </View>
            <Text style={styles.metaLabel}>Next billing date</Text>
            <Text style={styles.metaValue}>{formatDate(subscriptionExpiresAt)}</Text>
          </>
        )}

        {isVault && (
          <>
            <View style={[styles.badge, styles.badgePurple]}>
              <Text style={[styles.badgeText, styles.badgeTextPurple]}>🔮 Plus</Text>
            </View>
            <Text style={styles.metaLabel}>Expires</Text>
            <Text style={styles.metaValue}>{formatDate(subscriptionExpiresAt)}</Text>
          </>
        )}

        {isFree && (
          <>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Free</Text>
            </View>

            {/* Feature comparison */}
            <View style={styles.featureTable}>
              {[
                { feature: 'Daily trivia drop', free: '✅', plus: '✅', premium: '✅' },
                { feature: 'On-demand drops', free: '❌', plus: '1/day', premium: '∞' },
                { feature: 'Hints', free: '❌', plus: '✅', premium: '✅' },
                { feature: 'Score history', free: '❌', plus: '✅', premium: '✅' },
                { feature: 'Vault days', free: '❌', plus: '✅', premium: '✅' },
              ].map((row) => (
                <View key={row.feature} style={styles.featureRow}>
                  <Text style={styles.featureLabel}>{row.feature}</Text>
                  <Text style={styles.featureCell}>{row.free}</Text>
                  <Text style={[styles.featureCell, { color: colors.brand }]}>{row.plus}</Text>
                  <Text style={[styles.featureCell, { color: colors.goldDeep }]}>{row.premium}</Text>
                </View>
              ))}
              <View style={styles.featureHeaderRow}>
                <Text style={styles.featureHeaderLabel} />
                <Text style={styles.featureHeader}>Free</Text>
                <Text style={[styles.featureHeader, { color: colors.brand }]}>Plus</Text>
                <Text style={[styles.featureHeader, { color: colors.goldDeep }]}>👑 Premium</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.upgradeButton}
              activeOpacity={0.8}
              onPress={() =>
                Linking.openURL(
                  // TODO: replace with your production web URL
                  'https://trivioq.com/en/settings#subscription',
                )
              }
            >
              <Text style={styles.upgradeButtonText}>⚡ Upgrade to Premium</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Vault Card ───────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>🎁 Banked Premium Days: {onDemandTokensAvailable}</Text>

        {isAutoRenew && <Text style={styles.vaultSafeText}>Your days are safely banked. They will automatically unlock if you ever cancel your recurring subscription.</Text>}

        {canActivate && (
          <>
            {onDemandTokensAvailable === 0 ? (
              <Text style={styles.vaultEmptyText}>You have no banked days to activate.</Text>
            ) : (
              <>
                <Text style={styles.stepperLabel}>Days to activate</Text>
                <Stepper value={daysToActivate} min={stepMin} max={onDemandTokensAvailable} onChange={setDaysToActivate} />
              </>
            )}

            <TouchableOpacity style={[styles.activateButton, (onDemandTokensAvailable === 0 || activating) && styles.activateButtonDisabled]} onPress={handleActivate} disabled={onDemandTokensAvailable === 0 || activating} activeOpacity={0.8}>
              {activating ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={styles.activateButtonText}>
                  Activate {daysToActivate} Day{daysToActivate !== 1 ? 's' : ''}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      padding: 20,
      paddingBottom: 48,
      gap: 16,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgPrimary,
    },
    errorText: {
      color: colors.error,
      fontSize: 15,
      fontWeight: '600',
    },

    // Card
    card: {
      backgroundColor: colors.bgSecondary,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderColor,
      gap: 12,
    },
    cardHeader: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },

    // Badge
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.bgPrimary,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    badgeGold: {
      backgroundColor: colors.goldAccentFaint,
      borderColor: colors.goldDeep,
    },
    badgePurple: {
      backgroundColor: colors.purpleAccentFaint,
      borderColor: colors.purpleAccent,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    badgeTextGold: {
      color: colors.goldAccent,
    },
    badgeTextPurple: {
      color: colors.premium,
    },

    // Meta
    metaLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    metaValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },

    // Upgrade button
    upgradeButton: {
      marginTop: 4,
      backgroundColor: colors.brand,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    upgradeButtonText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.onAccent,
    },

    // Vault
    vaultSafeText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    vaultEmptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },

    // Stepper
    stepperLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    stepBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.bgPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    stepBtnDisabled: {
      opacity: 0.35,
    },
    stepBtnText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 26,
    },
    stepValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      minWidth: 40,
      textAlign: 'center',
    },

    // Activate button
    activateButton: {
      backgroundColor: colors.brand,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    activateButtonDisabled: {
      opacity: 0.4,
    },
    activateButtonText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.onAccent,
    },

    // Feature comparison table
    featureTable: {
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 4,
    },
    featureHeaderRow: {
      flexDirection: 'row',
      backgroundColor: colors.bgPrimary,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderColor,
    },
    featureHeaderLabel: {
      flex: 2,
    },
    featureHeader: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    featureRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderColor,
      alignItems: 'center',
    },
    featureLabel: {
      flex: 2,
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    featureCell: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
