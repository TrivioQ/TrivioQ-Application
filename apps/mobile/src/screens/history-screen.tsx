import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { DropHistoryFilter, DropHistoryItem } from '@trivioq/shared-types';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { api, queryKeys } from '../api/queries';
import { Chip, SkeletonList } from '../components/ui';
import { MarkdownText } from '../components/markdown-text';

type Choice = DropHistoryItem['question']['choices'][number];

function resolveChoiceText(choices: Choice[], idOrIndex: string | null): string | null {
  if (!idOrIndex || choices.length === 0) return idOrIndex;

  const obj = choices.find((c) => c.id === idOrIndex);
  if (obj) return obj.text;

  // Fallback: if it was saved as an index instead of an ID
  const idx = Number(idOrIndex);
  if (!isNaN(idx) && idx >= 0 && idx < choices.length) {
    return choices[idx].text;
  }
  return idOrIndex;
}

const FILTERS: DropHistoryFilter[] = ['all', 'correct', 'incorrect', 'revealed'];

export default function HistoryScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { userId } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<DropHistoryFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  // Categories seen so far, so the chip row stays stable while filtering.
  const [knownCategories, setKnownCategories] = useState<string[]>([]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: queryKeys.dropHistory(filter, category),
    queryFn: async ({ pageParam }) => {
      const page = await api.dropHistory({ filter, category, cursor: pageParam });
      setKnownCategories((prev) => {
        const next = new Set(prev);
        page.drops.forEach((d) => d.question.categories.forEach((c) => next.add(c.name)));
        return next.size === prev.length ? prev : Array.from(next).sort();
      });
      return page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!userId,
  });

  const drops = data?.pages.flatMap((p) => p.drops) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const difficultyColor: Record<string, string> = {
    EASY: colors.success,
    MEDIUM: colors.warning,
    HARD: colors.error,
  };

  const renderItem = ({ item }: { item: DropHistoryItem }) => {
    const date = item.answeredAt ? new Date(item.answeredAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('common.dashPlaceholder');

    const isAnswered = item.wasCorrect !== null;
    const statusIcon = item.revealedAnswer ? '👁' : isAnswered ? (item.wasCorrect ? '✅' : '❌') : '⏳';
    const statusColor = item.revealedAnswer ? colors.warning : isAnswered ? (item.wasCorrect ? colors.success : colors.error) : colors.textSecondary;
    const statusLabel = item.revealedAnswer ? t('history.revealed') : isAnswered ? (item.wasCorrect ? t('history.correct') : t('history.incorrect')) : t('history.unanswered');

    const selectedText = resolveChoiceText(item.question.choices, item.selectedChoiceId);
    const correctChoice = item.question.choices.find((c) => c.isCorrect);
    const correctText = correctChoice ? correctChoice.text : null;
    const categoryName = item.question.categories[0]?.name;
    const isOpen = expanded.has(item.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Text style={[styles.difficulty, { color: difficultyColor[item.question.difficultyLevel] ?? colors.textSecondary }]}>{item.question.difficultyLevel}</Text>
            {categoryName && (
              <Text style={styles.categoryBadge} numberOfLines={1}>
                {categoryName}
              </Text>
            )}
          </View>
          <Text style={styles.date}>{date}</Text>
        </View>

        <MarkdownText scale={0.95}>{item.question.questionText}</MarkdownText>

        {(selectedText != null || correctText != null) && (
          <View style={styles.answerBlock}>
            {selectedText != null && (
              <View style={styles.answerRow}>
                <Text style={styles.answerLabel}>{t('history.yourAnswer')}</Text>
                <Text style={[styles.answerValue, { color: item.wasCorrect ? colors.success : colors.error }]} numberOfLines={2}>
                  {item.wasCorrect ? '✓ ' : '✗ '}
                  {selectedText}
                </Text>
              </View>
            )}
            {(!item.wasCorrect || selectedText == null) && (
              <View style={styles.answerRow}>
                <Text style={styles.answerLabel}>{t('history.correctAnswer')}</Text>
                <Text style={[styles.answerValue, { color: colors.success }]} numberOfLines={2}>
                  {correctText}
                </Text>
              </View>
            )}
          </View>
        )}

        {item.question.explanationText ? (
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => toggleExpanded(item.id)} style={styles.explainToggle}>
            <Text style={styles.explainToggleText}>{isOpen ? `▾ ${t('history.hideExplanation')}` : `▸ ${t('history.whyAnswer')}`}</Text>
          </TouchableOpacity>
        ) : null}
        {isOpen && item.question.explanationText ? (
          <View style={styles.explanation}>
            <MarkdownText color={colors.textSecondary} scale={0.85}>
              {item.question.explanationText}
            </MarkdownText>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusIcon} {statusLabel}
          </Text>
          {item.pointsAwarded > 0 && <Text style={styles.points}>{t('history.pointsAwarded', { count: item.pointsAwarded })}</Text>}
        </View>
      </View>
    );
  };

  const header = (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity accessibilityRole="button" style={styles.reviewButton} onPress={() => navigation.navigate('ReviewMistakes')}>
        <Text style={styles.reviewButtonText}>🧠 {t('history.reviewMistakes')}</Text>
        <Text style={styles.reviewButtonSub}>{t('history.reviewMistakesSub')}</Text>
      </TouchableOpacity>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={t(`history.filter.${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>
      {knownCategories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip label={t('history.allCategories')} selected={category === null} onPress={() => setCategory(null)} />
          {knownCategories.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('history.error')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <SkeletonList count={4} itemHeight={140} />
      ) : (
        <FlatList
          data={drops}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIllustration}>📋</Text>
              <Text style={styles.emptyTitle}>{filter === 'all' && !category ? t('history.empty') : t('history.emptyFiltered')}</Text>
            </View>
          }
        />
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
      marginBottom: 12,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: colors.bgSecondary,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    difficulty: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    date: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    questionText: {
      fontSize: 15,
      color: colors.textPrimary,
      lineHeight: 22,
      marginBottom: 10,
    },
    answerBlock: {
      backgroundColor: colors.bgPrimary,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
      gap: 6,
    },
    answerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    answerLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      minWidth: 90,
      paddingTop: 1,
    },
    answerValue: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
      flexWrap: 'wrap',
    },
    categoryBadge: {
      fontSize: 11,
      color: colors.textSecondary,
      backgroundColor: colors.borderColor,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
      flexShrink: 1,
    },
    explainToggle: {
      paddingVertical: 6,
      marginBottom: 4,
    },
    explainToggleText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.brand,
    },
    explanation: {
      backgroundColor: colors.brandFaint,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
    },
    reviewButton: {
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.brand,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    },
    reviewButtonText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.brand,
    },
    reviewButtonSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cardFooter: {
      borderTopWidth: 1,
      borderTopColor: colors.borderColor,
      paddingTop: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    status: {
      fontSize: 13,
      fontWeight: '600',
    },
    points: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.brand,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
      paddingHorizontal: 32,
    },
    emptyIllustration: {
      fontSize: 64,
      marginBottom: 16,
      opacity: 0.5,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      opacity: 0.7,
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
    },
  });
