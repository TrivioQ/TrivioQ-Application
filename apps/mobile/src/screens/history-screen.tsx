import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';

interface DropRecord {
  id: string;
  scheduledDropTime: string;
  isAnswered: boolean;
  wasCorrect: boolean | null;
  question: {
    questionText: string;
    difficultyLevel: string;
  };
}

export default function HistoryScreen() {
  const { userId } = useAuth();

  const { data, isLoading, error } = useQuery<DropRecord[]>({
    queryKey: ['dropHistory', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/drops/history');
      return response.data;
    },
    enabled: !!userId,
  });

  const renderItem = ({ item }: { item: DropRecord }) => {
    const date = new Date(item.scheduledDropTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let statusIcon = '⏳';
    let statusColor = '#94a3b8';
    if (item.isAnswered) {
      statusIcon = item.wasCorrect ? '✅' : '❌';
      statusColor = item.wasCorrect ? '#22c55e' : '#ef4444';
    }

    const difficultyColor: Record<string, string> = {
      EASY: '#22c55e',
      MEDIUM: '#f59e0b',
      HARD: '#ef4444',
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.difficulty, { color: difficultyColor[item.question.difficultyLevel] ?? '#94a3b8' }]}>{item.question.difficultyLevel}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <Text style={styles.questionText} numberOfLines={2}>
          {item.question.questionText}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.status, { color: statusColor }]}>
            {statusIcon} {item.isAnswered ? (item.wasCorrect ? 'Correct' : 'Incorrect') : 'Unanswered'}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size='large' color='#6366f1' />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load history.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Drop History</Text>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No drops yet. Stay tuned! 🎯</Text>
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
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 10,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
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
