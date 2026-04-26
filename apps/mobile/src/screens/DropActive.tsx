import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, ScrollView, Modal } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

export default function DropActive() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);

  const onDemandMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/v1/drops/on-demand');
      return response.data;
    },
    onSuccess: () => {
      // Reset the component state for the new drop
      setIsRevealed(false);
      setTimeLeft(null);
      setIsExpired(false);
      setSelectedOption(null);
      setAnswerResult(null);
      queryClient.invalidateQueries({ queryKey: ['activeDrop'] });
    },
    onError: (err: any) => {
      if (err.response?.data?.code === 'UPGRADE_REQUIRED') {
        setIsPaywallVisible(true);
      } else {
        console.error('Failed to request drop:', err.response?.data || err.message);
      }
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activeDrop', userId],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/api/v1/drops/active');
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) return null;
        throw new Error('Network response was not ok');
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const response = await apiClient.post(`/api/v1/drops/${data.dropId}/submit`, {
        selectedOptionIndex: optionIndex,
      });
      return response.data;
    },
    onSuccess: (result) => {
      setAnswerResult(result);
      queryClient.invalidateQueries({ queryKey: ['userMe'] }); // Update dashboard metrics in the background
    },
  });

  useEffect(() => {
    // Stop the timer from ticking once it's answered or if there is no data
    if (!data?.expiresAt || answerResult) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((data.expiresAt - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    const diff = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
    setTimeLeft(diff);
    if (diff === 0) setIsExpired(true);

    return () => clearInterval(interval);
  }, [data?.expiresAt, answerResult]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size='large' color='#4c669f' />
        <Text style={styles.skeletonText}>Locating your drop...</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.questionText}>You have no active drops waiting.</Text>
      </View>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSelectOption = (index: number) => {
    if (isExpired || submitMutation.isPending || answerResult) return;
    setSelectedOption(index);
    submitMutation.mutate(index);
  };

  const handleShare = async () => {
    if (!answerResult) return;
    try {
      await Share.share({
        message: `I just hit a ${answerResult.newStreak} streak on TrivioQ! Can you beat my score?`,
      });
    } catch (error: any) {
      console.error(error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.timerContainer}>
        <Text style={[styles.timerText, isExpired && styles.timerExpired]}>{answerResult ? '--:--' : timeLeft !== null ? formatTime(timeLeft) : '--:--'}</Text>
        {isExpired && !answerResult && <Text style={styles.expiredLabel}>EXPIRED</Text>}
      </View>

      {!isRevealed ? (
        <View style={styles.mysteryBadge}>
          <Text style={styles.badgeTitle}>Mystery Drop</Text>
          <Text style={styles.badgeDetail}>Difficulty: {data.difficulty.toUpperCase()}</Text>
          <Text style={styles.badgeDetail}>Category: {data.category}</Text>

          <TouchableOpacity style={[styles.revealButton, isExpired && styles.disabledButton]} onPress={() => setIsRevealed(true)} disabled={isExpired}>
            <Text style={styles.revealButtonText}>Reveal Question</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{data.questionText}</Text>

          {data.options.map((option: string, index: number) => {
            let buttonStyle: any = styles.optionButton;

            if (answerResult) {
              if (index === answerResult.correctOptionIndex) {
                buttonStyle = [styles.optionButton, styles.correctButton];
              } else if (index === selectedOption) {
                buttonStyle = [styles.optionButton, styles.wrongButton];
              } else {
                buttonStyle = [styles.optionButton, styles.disabledButton];
              }
            } else if (submitMutation.isPending || isExpired) {
              buttonStyle = [styles.optionButton, styles.disabledButton];
            }

            return (
              <TouchableOpacity key={index} style={buttonStyle} disabled={isExpired || submitMutation.isPending || answerResult !== null} onPress={() => handleSelectOption(index)}>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            );
          })}

          {submitMutation.isPending && <ActivityIndicator size='small' color='#4c669f' style={{ marginTop: 20 }} />}

          {answerResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>{answerResult.isCorrect ? 'Correct! 🎉' : 'Incorrect ❌'}</Text>
              <Text style={styles.pointsText}>{answerResult.isCorrect ? `+${answerResult.pointsAwarded} points` : '0 points'}</Text>
              {answerResult.explanation && <Text style={styles.explanationText}>{answerResult.explanation}</Text>}

              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Text style={styles.shareButtonText}>Share to Social</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.nextQuestionButton} onPress={() => onDemandMutation.mutate()} disabled={onDemandMutation.isPending}>
                <Text style={styles.nextQuestionButtonText}>{onDemandMutation.isPending ? 'Requesting...' : 'Request Next Question'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Modal visible={isPaywallVisible} animationType='slide' transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Premium Paywall</Text>
            <Text style={styles.modalBody}>Want more trivia right now? Premium allows up to 100 questions a day and instant drops.</Text>
            <TouchableOpacity style={styles.premiumButton} onPress={() => setIsPaywallVisible(false)}>
              <Text style={styles.premiumButtonText}>Coming Soon!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    paddingTop: 80,
  },
  skeletonText: {
    marginTop: 20,
    color: '#888',
    fontSize: 16,
  },
  timerContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 54,
    fontWeight: 'bold',
    color: '#333',
    fontVariant: ['tabular-nums'],
  },
  timerExpired: {
    color: '#e74c3c',
  },
  expiredLabel: {
    color: '#e74c3c',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
  },
  mysteryBadge: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    width: '90%',
  },
  badgeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2c3e50',
  },
  badgeDetail: {
    fontSize: 18,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  revealButton: {
    marginTop: 30,
    backgroundColor: '#3498db',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '100%',
  },
  revealButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  questionContainer: {
    width: '100%',
    alignItems: 'stretch',
  },
  questionText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#2c3e50',
  },
  optionButton: {
    backgroundColor: '#4c669f',
    padding: 18,
    borderRadius: 12,
    marginVertical: 8,
  },
  correctButton: {
    backgroundColor: '#27ae60',
  },
  wrongButton: {
    backgroundColor: '#e74c3c',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  optionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2c3e50',
  },
  pointsText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 15,
  },
  explanationText: {
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  shareButton: {
    backgroundColor: '#9b59b6',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  nextQuestionButton: {
    backgroundColor: '#9b59b6',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: 15,
  },
  nextQuestionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
