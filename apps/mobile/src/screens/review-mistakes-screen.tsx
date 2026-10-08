import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { PracticeResult } from '@trivioq/shared-types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { api, queryKeys } from '../api/queries';
import { MarkdownText } from '../components/markdown-text';
import { SkeletonList } from '../components/ui';

/**
 * Re-quiz past incorrect answers. Purely for learning: the API awards no points
 * and changes no stats for practice answers.
 */
export default function ReviewMistakesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [score, setScore] = useState(0);

  const { data: questions, isLoading, error, refetch } = useQuery({ queryKey: queryKeys.mistakes, queryFn: api.mistakes });

  const check = useMutation({
    mutationFn: ({ questionId, option }: { questionId: string; option: number }) => api.practice(questionId, option),
    onSuccess: (r) => {
      setResult(r);
      if (r.isCorrect) setScore((s) => s + 1);
      Haptics.notificationAsync(r.isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    },
  });

  if (isLoading) return <SkeletonList count={3} itemHeight={120} />;

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t('review.error')}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={() => refetch()}>
          <Text style={styles.primaryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 56 }}>🎉</Text>
        <Text style={styles.title}>{t('review.emptyTitle')}</Text>
        <Text style={styles.muted}>{t('review.emptyBody')}</Text>
      </View>
    );
  }

  const done = index >= questions.length;
  if (done) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 56 }}>🧠</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t('review.doneTitle')}
        </Text>
        <Text style={styles.muted}>{t('review.doneBody', { score, total: questions.length })}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => {
            setIndex(0);
            setScore(0);
            setSelected(null);
            setResult(null);
            refetch();
          }}
        >
          <Text style={styles.primaryText}>{t('review.again')}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>{t('review.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const q = questions[index];

  const choose = (option: number) => {
    if (result || check.isPending) return;
    setSelected(option);
    check.mutate({ questionId: q.questionId, option });
  };

  const next = () => {
    setIndex((i) => i + 1);
    setSelected(null);
    setResult(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityLiveRegion="polite" style={styles.progress}>
        {t('review.progress', { current: index + 1, total: questions.length })} · {t('review.noPoints')}
      </Text>
      <View style={styles.badges}>
        <Text style={styles.badge}>{q.difficulty.toUpperCase()}</Text>
        <Text style={styles.badge}>{q.category}</Text>
      </View>

      <View style={styles.questionCard}>
        <MarkdownText>{q.questionText}</MarkdownText>
      </View>

      {q.options.map((o, i) => {
        const isCorrect = result && i === result.correctOptionIndex;
        const isWrong = result && i === selected && !result.isCorrect;
        return (
          <TouchableOpacity
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={`${t('drop.optionLabel', { n: i + 1 })}: ${o.text}${isCorrect ? `, ${t('drop.correctOption')}` : isWrong ? `, ${t('drop.yourWrongOption')}` : ''}`}
            disabled={!!result || check.isPending}
            onPress={() => choose(i)}
            style={[styles.option, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong, result && !isCorrect && !isWrong && { opacity: 0.5 }]}
          >
            {(isCorrect || isWrong) && <Text style={styles.marker}>{isCorrect ? '✓' : '✗'}</Text>}
            <View style={{ flex: 1 }}>
              <MarkdownText scale={0.9}>{o.text}</MarkdownText>
            </View>
          </TouchableOpacity>
        );
      })}

      {check.isPending && <ActivityIndicator color={colors.brand} style={{ marginTop: 12 }} />}

      {result && (
        <View accessibilityLiveRegion="polite" style={styles.resultCard}>
          <Text style={[styles.resultTitle, { color: result.isCorrect ? colors.success : colors.error }]}>{result.isCorrect ? t('review.correct') : t('review.incorrect')}</Text>
          {result.explanation ? (
            <MarkdownText color={colors.textSecondary} scale={0.9}>
              {result.explanation}
            </MarkdownText>
          ) : null}
          <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={next}>
            <Text style={styles.primaryText}>{index + 1 < questions.length ? t('review.next') : t('review.finish')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { padding: 20, backgroundColor: colors.bgPrimary, flexGrow: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bgPrimary },
    title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 12, textAlign: 'center' },
    muted: { fontSize: 15, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
    progress: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
    badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    badge: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.borderColor, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, overflow: 'hidden' },
    questionCard: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderColor, padding: 16, marginBottom: 16 },
    option: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.borderColor, borderRadius: radius.md, padding: 14, marginBottom: 10 },
    optionCorrect: { borderColor: colors.success, backgroundColor: colors.success + '22' },
    optionWrong: { borderColor: colors.error, backgroundColor: colors.error + '22' },
    marker: { fontSize: 18, fontWeight: '900', color: colors.textPrimary, marginRight: 8 },
    resultCard: { marginTop: 12, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.borderColor },
    resultTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
    primary: { marginTop: 16, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 28, alignItems: 'center' },
    primaryText: { color: colors.onAccent, fontWeight: '800', fontSize: 15 },
    secondary: { marginTop: 10, paddingVertical: 10 },
    secondaryText: { color: colors.textSecondary, fontWeight: '600' },
  });
