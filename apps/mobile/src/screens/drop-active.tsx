import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, ScrollView, Modal, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useConfirm } from '../components/confirm-modal';
import { useToast } from '../components/toast';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import apiClient from '../api/client';
import { QuestionDropPayload } from '@trivioq/shared-types';
import { MarkdownText } from '../components/markdown-text';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';

// ── Animated Option Button ───────────────────────────────────────────────────

function AnimatedOption({ option, entranceDelay, buttonStyle, disabled, onPress }: { option: { id: string; text: string }; index: number; entranceDelay: number; buttonStyle: any; disabled: boolean; onPress: () => void }) {
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      delay: entranceDelay,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 300 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300 }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: entranceAnim,
        transform: [
          { scale: scaleAnim },
          {
            translateX: entranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [40, 0],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity style={buttonStyle} disabled={disabled} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1}>
        <MarkdownText color="#ffffff" scale={0.9}>
          {option.text}
        </MarkdownText>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Mystery Badge Glow Animation ─────────────────────────────────────────────

function GlowBorder({ colors }: { colors: ThemeColors }) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }), Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false })])).start();
  }, []);

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderColor, colors.brand],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.xl,
        borderWidth: 2,
        borderColor,
      }}
    />
  );
}

// ── Question Mark Pulse Icon ──────────────────────────────────────────────────

function PulsingQuestionMark({ colors }: { colors: ThemeColors }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })])).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 20 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.brand + '20',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.brand + '40',
        }}
      >
        <Text style={{ fontSize: 40 }}>❓</Text>
      </View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function DropActive() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

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
      // Haptic feedback on answer result
      if (result.isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

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
        <ActivityIndicator size="large" color={colors.brand} />
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={[styles.timerText, isExpired && styles.timerExpired]}>{answerResult ? '--:--' : timeLeft !== null ? formatTime(timeLeft) : '--:--'}</Text>
        {isExpired && !answerResult && <Text style={styles.expiredLabel}>{t('drop.expired')}</Text>}
      </View>

      {!isRevealed ? (
        /* ── Mystery Badge ── */
        <View style={styles.mysteryBadge}>
          <GlowBorder colors={colors} />
          <PulsingQuestionMark colors={colors} />
          <Text style={styles.badgeTitle}>{t('drop.mysteryTitle')}</Text>
          <Text style={styles.badgeDetail}>{t('drop.difficulty', { value: data.difficulty.toUpperCase() })}</Text>
          <Text style={styles.badgeDetail}>{t('drop.category', { value: data.category })}</Text>
          <Text style={styles.badgeDetail}>{t('drop.worth', { value: data.pointsValue })}</Text>

          <TouchableOpacity
            style={[styles.revealButton, (isExpired || revealQuestionMutation.isPending) && styles.disabledButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              revealQuestionMutation.mutate();
            }}
            disabled={isExpired || revealQuestionMutation.isPending}
            activeOpacity={0.85}
          >
            <Text style={styles.revealButtonText}>{revealQuestionMutation.isPending ? t('drop.revealLoading') : t('drop.revealQuestion')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.questionContainer}>
          {/* Question */}
          <View style={styles.questionMarkdownWrapper}>
            <MarkdownText>{data.questionText}</MarkdownText>
          </View>

          {/* Hint section */}
          {!answerResult && !isAnswerKnown && (
            <View style={styles.assistRow}>
              {hintText ? (
                <View style={styles.hintBox}>
                  <Text style={styles.hintLabel}>
                    {t('drop.hintLabel')}
                    {hintCostDeducted != null ? ` (−${hintCostDeducted} pts)` : ''}
                  </Text>
                  <MarkdownText color={colors.warning} scale={0.85}>
                    {hintText}
                  </MarkdownText>
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

          {/* Answer Options — staggered entrance + scale-on-press */}
          {data.options.map((option, index) => {
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

            return <AnimatedOption key={option.id} option={option} index={index} entranceDelay={index * 80} buttonStyle={buttonStyle} disabled={isExpired || submitMutation.isPending || answerResult !== null} onPress={() => handleSelectOption(index)} />;
          })}

          {submitMutation.isPending && <ActivityIndicator size="small" color={colors.brand} style={{ marginTop: 20 }} />}

          {/* Result */}
          {answerResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>{answerResult.revealedAnswer ? t('drop.answerWasRevealed') : answerResult.isCorrect ? t('drop.correct') : t('drop.incorrect')}</Text>
              <Text style={styles.pointsText}>{answerResult.pointsAwarded > 0 ? t('drop.points', { count: answerResult.pointsAwarded }) : t('drop.zeroPoints')}</Text>

              {answerResult.explanation && (
                <View style={styles.explanationWrapper}>
                  <MarkdownText color={colors.textSecondary} scale={0.9}>
                    {answerResult.explanation}
                  </MarkdownText>
                </View>
              )}

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

      {/* Paywall Modal */}
      <Modal visible={isPaywallVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('drop.paywallTitle')}</Text>
            <Text style={styles.modalBody}>{t('drop.paywallBody')}</Text>
            <TouchableOpacity style={styles.premiumButton} onPress={() => setIsPaywallVisible(false)}>
              <Text style={styles.premiumButtonText}>{t('drop.paywallCta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsPaywallVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('drop.paywallDismiss')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 20,
      backgroundColor: colors.bgPrimary,
      alignItems: 'center',
      paddingTop: 60,
    },
    skeletonText: {
      marginTop: 20,
      color: colors.textSecondary,
      fontSize: 16,
    },
    timerContainer: {
      marginBottom: 36,
      alignItems: 'center',
    },
    timerText: {
      fontSize: 54,
      fontWeight: 'bold',
      color: colors.brand,
      fontVariant: ['tabular-nums'],
    },
    timerExpired: {
      color: colors.error,
    },
    expiredLabel: {
      color: colors.error,
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 4,
    },

    // Mystery badge
    mysteryBadge: {
      backgroundColor: colors.bgSecondary,
      padding: 36,
      borderRadius: radius.xl,
      alignItems: 'center',
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
      width: '95%',
      position: 'relative',
      overflow: 'hidden',
    },
    badgeTitle: {
      fontSize: 26,
      fontWeight: 'bold',
      marginBottom: 16,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    badgeDetail: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    revealButton: {
      marginTop: 28,
      backgroundColor: colors.brand,
      paddingVertical: 15,
      paddingHorizontal: 30,
      borderRadius: radius.pill,
      width: '100%',
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    revealButtonText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: 'bold',
      textAlign: 'center',
    },

    // Question area
    questionContainer: {
      width: '100%',
      alignItems: 'stretch',
    },
    questionMarkdownWrapper: {
      marginBottom: 20,
    },
    questionText: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: colors.textPrimary,
    },

    // Assist row
    assistRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    assistButton: {
      flex: 1,
      backgroundColor: colors.warning,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    revealAnswerButton: {
      backgroundColor: colors.brand + 'CC',
    },
    assistButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 13,
      textAlign: 'center',
    },
    hintBox: {
      flex: 1,
      backgroundColor: colors.warning + '18',
      borderWidth: 1,
      borderColor: colors.warning + '60',
      borderRadius: radius.md,
      padding: 10,
    },
    hintLabel: {
      fontWeight: 'bold',
      color: colors.warning,
      marginBottom: 4,
      fontSize: 13,
    },

    // Answer revealed banner
    revealedBanner: {
      backgroundColor: colors.error + '15',
      borderWidth: 1,
      borderColor: colors.error + '50',
      borderRadius: radius.md,
      padding: 10,
      marginBottom: 16,
    },
    revealedBannerText: {
      color: colors.error,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
    },

    // Option buttons
    optionButton: {
      backgroundColor: colors.brand,
      padding: 18,
      borderRadius: radius.md,
      marginVertical: 6,
    },
    correctButton: {
      backgroundColor: colors.success,
    },
    wrongButton: {
      backgroundColor: colors.error,
    },
    disabledButton: {
      backgroundColor: colors.borderColor,
      opacity: 0.6,
    },

    // Result card
    resultContainer: {
      marginTop: 28,
      padding: 24,
      backgroundColor: colors.bgSecondary,
      borderRadius: radius.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderColor,
      width: '100%',
    },
    resultTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 6,
      color: colors.textPrimary,
    },
    pointsText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    explanationWrapper: {
      width: '100%',
      marginBottom: 20,
    },
    shareButton: {
      backgroundColor: colors.brand + 'CC',
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: radius.pill,
      width: '100%',
    },
    shareButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
      textAlign: 'center',
    },
    nextQuestionButton: {
      backgroundColor: colors.brand,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: radius.pill,
      marginTop: 12,
      width: '100%',
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 5,
    },
    nextQuestionButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
      textAlign: 'center',
    },

    // Paywall modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '88%',
      backgroundColor: colors.bgSecondary,
      padding: 30,
      borderRadius: radius.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.brand + '40',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 12,
      color: colors.brand,
    },
    modalBody: {
      fontSize: 15,
      textAlign: 'center',
      color: colors.textPrimary,
      marginBottom: 24,
      lineHeight: 22,
    },
    premiumButton: {
      backgroundColor: colors.brand,
      paddingVertical: 14,
      paddingHorizontal: 30,
      borderRadius: radius.pill,
      width: '100%',
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
    },
    premiumButtonText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });
