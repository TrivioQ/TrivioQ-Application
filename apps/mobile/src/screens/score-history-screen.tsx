import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import apiClient from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScorePeriod {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string | null;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  rank: number | null;
}

type TabKey = 'weekly' | 'monthly';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPeriodLabel(period: ScorePeriod, locale: string): string {
  const start = new Date(period.periodStart);
  if (period.periodType === 'WEEKLY') {
    const end = period.periodEnd ? new Date(period.periodEnd) : null;
    const s = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const e = end ? end.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `${s} – ${e}`;
  }
  return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function getRankLabel(rank: number | null, noBonusLabel: string): string {
  if (!rank) return noBonusLabel;
  if (rank === 1) return '🥇 #1';
  if (rank === 2) return '🥈 #2';
  if (rank === 3) return '🥉 #3';
  return `#${rank}`;
}

function getRankColor(rank: number | null, colors: ThemeColors): string {
  if (!rank) return colors.textSecondary;
  if (rank === 1) return colors.medalGold;
  if (rank === 2) return colors.medalSilver;
  if (rank === 3) return colors.medalBronze;
  return colors.brand;
}

// ─── Scoring Guide Card ───────────────────────────────────────────────────────

function ScoringGuideCard({ label, pts, borderColor, textColor, diffLabel, styles }: { label: string; pts: string; borderColor: string; textColor: string; diffLabel: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={[styles.guideCard, { borderColor }]}>
      <Text style={[styles.guideDiffLabel, { color: textColor }]}>{diffLabel}</Text>
      <Text style={[styles.guideDiff, { color: textColor }]}>{label}</Text>
      <Text style={styles.guidePts}>{pts}</Text>
    </View>
  );
}

// ─── Period Row ───────────────────────────────────────────────────────────────

function PeriodRow({ item, colors, styles, noBonusLabel, locale }: { item: ScorePeriod; colors: ThemeColors; styles: ReturnType<typeof createStyles>; noBonusLabel: string; locale: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowPeriodCell}>
        <Text style={styles.rowPeriodText} numberOfLines={2}>
          {formatPeriodLabel(item, locale)}
        </Text>
      </View>
      <View style={styles.rowCell}>
        <Text style={styles.rowValue}>{item.baseScore.toLocaleString()}</Text>
      </View>
      <View style={styles.rowCell}>{item.bonusScore > 0 ? <Text style={[styles.rowValue, { color: colors.success, fontWeight: '700' }]}>+{item.bonusScore.toLocaleString()}</Text> : <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{noBonusLabel}</Text>}</View>
      <View style={styles.rowCell}>
        <Text style={[styles.rowValue, styles.rowTotal]}>{item.totalScore.toLocaleString()}</Text>
      </View>
      <View style={styles.rowCell}>
        <Text style={[styles.rowValue, { color: getRankColor(item.rank, colors) }]}>{getRankLabel(item.rank, noBonusLabel)}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScoreHistoryScreen() {
  const { t, i18n } = useTranslation();
  const { userId } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TabKey>('weekly');

  const { data, isLoading, error } = useQuery<{ weekly: ScorePeriod[]; monthly: ScorePeriod[] }>({
    queryKey: ['scoreHistory', userId],
    queryFn: async () => {
      const [weeklyRes, monthlyRes] = await Promise.all([apiClient.get('/api/v1/users/me/score-history?period=weekly'), apiClient.get('/api/v1/users/me/score-history?period=monthly')]);
      return {
        weekly: weeklyRes.data.history ?? [],
        monthly: monthlyRes.data.history ?? [],
      };
    },
    enabled: !!userId,
  });

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
        <Text style={styles.errorText}>{t('scoreHistory.error')}</Text>
      </View>
    );
  }

  const rows = activeTab === 'weekly' ? (data?.weekly ?? []) : (data?.monthly ?? []);

  const guideCards = [
    { label: t('scoreHistory.easyLabel'), pts: t('scoreHistory.easyPts'), borderColor: colors.successFaint, textColor: colors.success },
    { label: t('scoreHistory.mediumLabel'), pts: t('scoreHistory.mediumPts'), borderColor: colors.warningFaint, textColor: colors.warning },
    { label: t('scoreHistory.hardLabel'), pts: t('scoreHistory.hardPts'), borderColor: colors.errorFaint, textColor: colors.error },
  ];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={rows}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          {/* ── Scoring Guide ── */}
          <View style={styles.guideRow}>
            {guideCards.map((card) => (
              <ScoringGuideCard key={card.label} label={card.label} pts={card.pts} borderColor={card.borderColor} textColor={card.textColor} diffLabel={t('scoreHistory.difficultyLabel')} styles={styles} />
            ))}
          </View>

          {/* ── Bonus Points Callout ── */}
          <View style={styles.bonusCard}>
            <Text style={styles.bonusTitle}>{t('scoreHistory.bonusPointsTitle')}</Text>
            <View style={styles.bonusRow}>
              <View style={styles.bonusCol}>
                <Text style={styles.bonusColTitle}>{t('scoreHistory.weeklyTop10')}</Text>
                <Text style={styles.bonusColDesc}>{t('scoreHistory.weeklyBonusDesc')}</Text>
                <Text style={styles.bonusColNote}>{t('scoreHistory.weeklyBonusNote')}</Text>
              </View>
              <View style={styles.bonusDivider} />
              <View style={styles.bonusCol}>
                <Text style={styles.bonusColTitle}>{t('scoreHistory.monthlyTop10')}</Text>
                <Text style={styles.bonusColDesc}>{t('scoreHistory.monthlyBonusDesc')}</Text>
                <Text style={styles.bonusColNote}>{t('scoreHistory.monthlyBonusNote')}</Text>
              </View>
            </View>
          </View>

          {/* ── Tab Switcher ── */}
          <View style={styles.tabBar}>
            {(['weekly', 'monthly'] as TabKey[]).map((tab) => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }}>
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab === 'weekly' ? t('scoreHistory.weekly') : t('scoreHistory.monthly')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Table Header ── */}
          {rows.length > 0 && (
            <View style={[styles.row, styles.tableHeader]}>
              <View style={styles.rowPeriodCell}>
                <Text style={styles.headerText}>{t('scoreHistory.periodHeader')}</Text>
              </View>
              <View style={styles.rowCell}>
                <Text style={styles.headerText}>{t('scoreHistory.triviaScoreHeader')}</Text>
              </View>
              <View style={styles.rowCell}>
                <Text style={styles.headerText}>{t('scoreHistory.bonusHeader')}</Text>
              </View>
              <View style={styles.rowCell}>
                <Text style={styles.headerText}>{t('scoreHistory.totalHeader')}</Text>
              </View>
              <View style={styles.rowCell}>
                <Text style={styles.headerText}>{t('scoreHistory.rankHeader')}</Text>
              </View>
            </View>
          )}
        </>
      }
      renderItem={({ item }) => <PeriodRow item={item} colors={colors} styles={styles} noBonusLabel={t('scoreHistory.noBonusYet')} locale={i18n.language} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>{t('scoreHistory.noDataYet')}</Text>
        </View>
      }
      ListFooterComponent={rows.length > 0 ? <Text style={styles.footerNote}>{t('scoreHistory.historyNote')}</Text> : null}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    contentContainer: {
      paddingBottom: 40,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgPrimary,
      padding: 24,
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
      textAlign: 'center',
    },

    // ── Scoring Guide ─────────────────────────────────────────────────────────
    guideRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 8,
    },
    guideCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
    },
    guideDiffLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    guideDiff: {
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    guidePts: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.textPrimary,
    },

    // ── Bonus Card ────────────────────────────────────────────────────────────
    bonusCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.brand + '40',
      backgroundColor: colors.bgSecondary,
    },
    bonusTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.brand,
      marginBottom: 10,
    },
    bonusRow: {
      flexDirection: 'row',
    },
    bonusCol: {
      flex: 1,
    },
    bonusDivider: {
      width: 1,
      backgroundColor: colors.borderColor,
      marginHorizontal: 12,
    },
    bonusColTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    bonusColDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 4,
    },
    bonusColNote: {
      fontSize: 10,
      color: colors.textSecondary,
      opacity: 0.6,
    },

    // ── Tab Switcher ──────────────────────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    tab: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: colors.brand,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 4,
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabLabelActive: {
      color: colors.onAccent,
      fontWeight: '700',
    },

    // ── Table ─────────────────────────────────────────────────────────────────
    tableHeader: {
      marginTop: 12,
      marginBottom: 0,
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    row: {
      flexDirection: 'row',
      marginHorizontal: 16,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderTopWidth: 0,
      backgroundColor: colors.bgPrimary,
    },
    rowPeriodCell: {
      flex: 2,
      paddingRight: 6,
    },
    rowCell: {
      flex: 1.2,
      alignItems: 'flex-end',
    },
    headerText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    rowPeriodText: {
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '600',
      lineHeight: 16,
    },
    rowValue: {
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    rowTotal: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.brand,
    },

    // ── Empty ─────────────────────────────────────────────────────────────────
    emptyContainer: {
      paddingVertical: 48,
      alignItems: 'center',
      marginHorizontal: 16,
    },
    emptyIcon: {
      fontSize: 44,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    // ── Footer ────────────────────────────────────────────────────────────────
    footerNote: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      paddingHorizontal: 24,
      opacity: 0.7,
    },
  });
