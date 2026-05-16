import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';

interface DropRecord {
  id: string;
  wasCorrect: boolean | null;
  pointsAwarded: number;
  usedHint: boolean;
  hintCostDeducted: number;
  revealedAnswer: boolean;
  selectedChoiceId: string | null;
  answeredAt: string | null;
  question: {
    questionText: string;
    difficultyLevel: string;
    categories: { name: string }[];
    choices: { id: string; text: string; isCorrect: boolean }[];
  };
}

function resolveChoiceText(choices: { id: string; text: string; isCorrect: boolean }[], idOrIndex: string | null): string | null {
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

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();

  const {
    data: dropsRes,
    isLoading,
    error,
  } = useQuery<{ drops: DropRecord[] }>({
    queryKey: ['dropHistory', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me/recent-drops');
      return response.data;
    },
    enabled: !!userId,
  });

  const drops = dropsRes?.drops ?? [];

  const renderItem = ({ item }: { item: DropRecord }) => {
    const date = item.answeredAt ? new Date(item.answeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const isAnswered = item.wasCorrect !== null;
    const statusIcon = item.revealedAnswer ? '👁' : isAnswered ? (item.wasCorrect ? '✅' : '❌') : '⏳';
    const statusColor = item.revealedAnswer ? '#f97316' : isAnswered ? (item.wasCorrect ? '#22c55e' : '#ef4444') : '#94a3b8';

    const difficultyColor: Record<string, string> = {
      EASY: '#22c55e',
      MEDIUM: '#f59e0b',
      HARD: '#ef4444',
    };

    const selectedText = resolveChoiceText(item.question.choices, item.selectedChoiceId);
    const correctChoice = item.question.choices.find((c) => c.isCorrect);
    const correctText = correctChoice ? correctChoice.text : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.difficulty, { color: difficultyColor[item.question.difficultyLevel] ?? '#94a3b8' }]}>{item.question.difficultyLevel}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>

        <Text style={styles.questionText}>{item.question.questionText}</Text>

        {(selectedText != null || correctText != null) && (
          <View style={styles.answerBlock}>
            {selectedText != null && (
              <View style={styles.answerRow}>
                <Text style={styles.answerLabel}>{t('history.yourAnswer')}</Text>
                <Text style={[styles.answerValue, { color: item.wasCorrect ? '#22c55e' : '#ef4444' }]} numberOfLines={2}>
                  {selectedText}
                </Text>
              </View>
            )}
            {(!item.wasCorrect || selectedText == null) && (
              <View style={styles.answerRow}>
                <Text style={styles.answerLabel}>{t('history.correctAnswer')}</Text>
                <Text style={[styles.answerValue, { color: '#22c55e' }]} numberOfLines={2}>
                  {correctText}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusIcon} {item.revealedAnswer ? t('history.revealed') : isAnswered ? (item.wasCorrect ? t('history.correct') : t('history.incorrect')) : t('history.unanswered')}
          </Text>
          {item.pointsAwarded > 0 && <Text style={styles.points}>+{item.pointsAwarded} pts</Text>}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('history.error')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('history.title')}</Text>
      <FlatList
        data={drops}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    color: '#64748b',
  },
  questionText: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 10,
  },
  answerBlock: {
    backgroundColor: 'rgba(255,255,255,0.03)',
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
    color: '#64748b',
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
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
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
    color: '#818cf8',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
});
