import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, ScrollView, Modal } from 'react-native';
import { useConfirm } from '../components/confirm-modal';
import { useToast } from '../components/toast';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';
import { QuestionDropPayload } from '@trivioq/shared-types';

export default function DropActive() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);

  const [hintText, setHintText] = useState<string | null>(null);
  const [hintCostDeducted, setHintCostDeducted] = useState<number | null>(null);
  const [revealedCorrectIndex, setRevealedCorrectIndex] = useState<number | null>(null);

  const onDemandMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/v1/drops/on-demand');
      return response.data;
    },
    onSuccess: () => {
      setIsRevealed(false);
      setTimeLeft(null);
      setIsExpired(false);
      setSelectedOption(null);
      setAnswerResult(null);
      setHintText(null);
      setHintCostDeducted(null);
      setRevealedCorrectIndex(null);
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

  const { data, isLoading, isError } = useQuery<QuestionDropPayload | null>({
    queryKey: ['activeDrop', userId],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/api/v1/drops/active');
        if (response.status === 204 || !response.data || Object.keys(response.data).length === 0) {
          return null;
        }
        return response.data as QuestionDropPayload;
      } catch (error: any) {
        if (error.response?.status === 404) return null;
        throw new Error(t('drop.networkError'));
      }
    },
  });

  // Restore hint placeholder if hint was already used in a prior session
  useEffect(() => {
    if (data?.usedHint && !hintText) {
      setHintText(t('drop.hintUsed'));
    }
  }, [data?.usedHint]);

  // Restore revealed state if question was already revealed in a prior session
  useEffect(() => {
    if (data?.answerDeadline) setIsRevealed(true);
  }, [data?.answerDeadline]);

  const hintMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/v1/drops/${data!.dropId}/hint`);
      return response.data;
    },
    onSuccess: (result) => {
      setHintText(result.hintText);
      setHintCostDeducted(result.hintCost);
      queryClient.invalidateQueries({ queryKey: ['userMe'] });
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || t('drop.hintAlertTitle');
      toast({ message, type: 'error' });
    },
  });

  const revealQuestionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/v1/drops/${data!.dropId}/reveal-question`);
      return response.data;
    },
    onSuccess: (result) => {
      // answerDeadline is now set server-side; the active-drop query will pick it up on next fetch
      if (result.answerDeadline) {
        setTimeLeft(Math.max(0, Math.floor((result.answerDeadline - Date.now()) / 1000)));
      }
      setIsRevealed(true);
      queryClient.invalidateQueries({ queryKey: ['activeDrop'] });
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || t('drop.revealAlertTitle');
      toast({ message, type: 'error' });
    },
  });

  const revealMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/v1/drops/${data!.dropId}/reveal-answer`);
      return response.data;
    },
    onSuccess: (result) => {
      setRevealedCorrectIndex(result.correctOptionIndex);
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || t('drop.revealAlertTitle');
      toast({ message, type: 'error' });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const response = await apiClient.post(`/api/v1/drops/${data!.dropId}/submit`, {
        selectedOptionIndex: optionIndex,
      });
      return response.data;
    },
    onSuccess: (result) => {
      setAnswerResult(result);
      queryClient.invalidateQueries({ queryKey: ['userMe'] });
    },
  });

  // Determine the effective deadline: use answerDeadline if the question
  // has been revealed (server-enforced per-difficulty timer), otherwise
  // fall back to the overall drop expiration.
  const effectiveDeadline: number | null = data?.answerDeadline ?? data?.expiresAt ?? null;

  useEffect(() => {
    if (!effectiveDeadline || answerResult) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((effectiveDeadline - now) / 1000));
      setTimeLeft(diff);
      if (diff === 0) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    const diff = Math.max(0, Math.floor((effectiveDeadline - Date.now()) / 1000));
    setTimeLeft(diff);
    if (diff === 0) setIsExpired(true);

    return () => clearInterval(interval);
  }, [effectiveDeadline, answerResult]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4c669f" />
        <Text style={styles.skeletonText}>{t('drop.loading')}</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.questionText}>{t('drop.noDrops')}</Text>
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

  const handleHint = async () => {
    if (data.usedHint || hintText) return;
    const ok = await confirm({
      title: t('drop.hintAlertTitle'),
      message: t('drop.hintAlertBody', { cost: data.hintCost }),
      confirmLabel: t('drop.getHint'),
    });
    if (ok) hintMutation.mutate();
  };

  const handleRevealAnswer = async () => {
    if (revealedCorrectIndex !== null || answerResult) return;
    const ok = await confirm({
      title: t('drop.revealAlertTitle'),
      message: t('drop.revealAlertBody'),
      confirmLabel: t('drop.revealAlertConfirm'),
      isDestructive: true,
    });
    if (ok) revealMutation.mutate();
  };

  const handleShare = async () => {
    if (!answerResult) return;
    try {
      await Share.share({
        message: t('drop.shareMessage', { streak: answerResult.newStreak }),
      });
    } catch (error: any) {
      console.error(error.message);
    }
  };

  const isAnswerKnown = revealedCorrectIndex !== null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.timerContainer}>
        <Text style={[styles.timerText, isExpired && styles.timerExpired]}>{answerResult ? '--:--' : timeLeft !== null ? formatTime(timeLeft) : '--:--'}</Text>
        {isExpired && !answerResult && <Text style={styles.expiredLabel}>{t('drop.expired')}</Text>}
      </View>

      {!isRevealed ? (
        <View style={styles.mysteryBadge}>
          <Text style={styles.badgeTitle}>{t('drop.mysteryTitle')}</Text>
          <Text style={styles.badgeDetail}>{t('drop.difficulty', { value: data.difficulty.toUpperCase() })}</Text>
          <Text style={styles.badgeDetail}>{t('drop.category', { value: data.category })}</Text>
          <Text style={styles.badgeDetail}>{t('drop.worth', { value: data.pointsValue })}</Text>

          <TouchableOpacity style={[styles.revealButton, (isExpired || revealQuestionMutation.isPending) && styles.disabledButton]} onPress={() => revealQuestionMutation.mutate()} disabled={isExpired || revealQuestionMutation.isPending}>
            <Text style={styles.revealButtonText}>{revealQuestionMutation.isPending ? t('drop.revealLoading') : t('drop.revealQuestion')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{data.questionText}</Text>

          {/* Hint section */}
          {!answerResult && !isAnswerKnown && (
            <View style={styles.assistRow}>
              {hintText ? (
                <View style={styles.hintBox}>
                  <Text style={styles.hintLabel}>
                    {t('drop.hintLabel')}
                    {hintCostDeducted != null ? ` (−${hintCostDeducted} pts)` : ''}
                  </Text>
                  <Text style={styles.hintText}>{hintText}</Text>
                </View>
              ) : (
                <TouchableOpacity style={[styles.assistButton, (hintMutation.isPending || isExpired || data.usedHint) && styles.disabledButton]} onPress={handleHint} disabled={hintMutation.isPending || isExpired || data.usedHint}>
                  <Text style={styles.assistButtonText}>{data.usedHint ? t('drop.hintUsed') : t('drop.hintButton', { cost: data.hintCost })}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.assistButton, styles.revealAnswerButton, (revealMutation.isPending || isExpired || data.revealedAnswer) && styles.disabledButton]} onPress={handleRevealAnswer} disabled={revealMutation.isPending || isExpired || data.revealedAnswer || isAnswerKnown}>
                <Text style={styles.assistButtonText}>{data.revealedAnswer || isAnswerKnown ? t('drop.answerRevealed') : t('drop.showAnswer')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Answer revealed banner */}
          {isAnswerKnown && !answerResult && (
            <View style={styles.revealedBanner}>
              <Text style={styles.revealedBannerText}>{t('drop.revealedBanner')}</Text>
            </View>
          )}

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
            } else if (isAnswerKnown) {
              buttonStyle = index === revealedCorrectIndex ? [styles.optionButton, styles.correctButton] : [styles.optionButton, styles.disabledButton];
            } else if (submitMutation.isPending || isExpired) {
              buttonStyle = [styles.optionButton, styles.disabledButton];
            }

            return (
              <TouchableOpacity key={index} style={buttonStyle} disabled={isExpired || submitMutation.isPending || answerResult !== null} onPress={() => handleSelectOption(index)}>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            );
          })}

          {submitMutation.isPending && <ActivityIndicator size="small" color="#4c669f" style={{ marginTop: 20 }} />}

          {answerResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>{answerResult.revealedAnswer ? t('drop.answerWasRevealed') : answerResult.isCorrect ? t('drop.correct') : t('drop.incorrect')}</Text>
              <Text style={styles.pointsText}>{answerResult.pointsAwarded > 0 ? t('drop.points', { count: answerResult.pointsAwarded }) : t('drop.zeroPoints')}</Text>
              {answerResult.explanation && <Text style={styles.explanationText}>{answerResult.explanation}</Text>}

              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Text style={styles.shareButtonText}>{t('drop.shareButton')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.nextQuestionButton} onPress={() => onDemandMutation.mutate()} disabled={onDemandMutation.isPending}>
                <Text style={styles.nextQuestionButtonText}>{onDemandMutation.isPending ? t('drop.requesting') : t('drop.requestNext')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Modal visible={isPaywallVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('drop.paywallTitle')}</Text>
            <Text style={styles.modalBody}>{t('drop.paywallBody')}</Text>
            <TouchableOpacity style={styles.premiumButton} onPress={() => setIsPaywallVisible(false)}>
              <Text style={styles.premiumButtonText}>{t('drop.paywallCta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsPaywallVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: '#999', fontSize: 14 }}>{t('drop.paywallDismiss')}</Text>
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
    marginBottom: 20,
    textAlign: 'center',
    color: '#2c3e50',
  },
  assistRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  assistButton: {
    flex: 1,
    backgroundColor: '#f39c12',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  revealAnswerButton: {
    backgroundColor: '#8e44ad',
  },
  assistButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  hintBox: {
    flex: 1,
    backgroundColor: '#fef9e7',
    borderWidth: 1,
    borderColor: '#f39c12',
    borderRadius: 10,
    padding: 10,
  },
  hintLabel: {
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 4,
    fontSize: 13,
  },
  hintText: {
    color: '#7d6608',
    fontSize: 13,
  },
  revealedBanner: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#e74c3c',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  revealedBannerText: {
    color: '#c0392b',
    textAlign: 'center',
    fontSize: 13,
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
