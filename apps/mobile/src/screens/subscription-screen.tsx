import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useToast } from '../components/toast';

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
        <ActivityIndicator size='large' color='#6366f1' />
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
            <TouchableOpacity style={styles.upgradeButton} activeOpacity={0.8}>
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
                <ActivityIndicator size='small' color='#fff' />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    backgroundColor: '#0f172a',
  },
  errorText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600',
  },

  // Card
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 4,
  },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeGold: {
    backgroundColor: 'rgba(234,179,8,0.15)',
    borderColor: '#ca8a04',
  },
  badgePurple: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: '#7c3aed',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  badgeTextGold: {
    color: '#fde047',
  },
  badgeTextPurple: {
    color: '#a78bfa',
  },

  // Meta
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 2,
  },

  // Upgrade button
  upgradeButton: {
    marginTop: 4,
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },

  // Vault
  vaultSafeText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  vaultEmptyText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
  },

  // Stepper
  stepperLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
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
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    lineHeight: 26,
  },
  stepValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f1f5f9',
    minWidth: 40,
    textAlign: 'center',
  },

  // Activate button
  activateButton: {
    backgroundColor: '#6366f1',
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
    color: '#fff',
  },
});
