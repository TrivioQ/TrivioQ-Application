import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { toast } from 'sonner-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { MIN_CATEGORIES, localHHMMToUtc } from '@trivioq/shared-types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { api, queryKeys } from '../api/queries';
import { CategoryPicker } from '../components/category-picker';
import { TimePickerField } from '../components/time-picker-field';
import { Skeleton } from '../components/ui';
import { useAuth } from '../context/auth-context';

const STEPS = ['intro', 'sample', 'categories', 'trial', 'window', 'finish'] as const;
type Step = (typeof STEPS)[number];
const SAMPLE_CORRECT_INDEX = 2;

/**
 * First-run setup, shown until `onboardingComplete` is true. Completing it calls
 * POST /v1/onboarding/complete, which saves categories + window and starts the trial.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [sampleChoice, setSampleChoice] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [trialAccepted, setTrialAccepted] = useState(false);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('21:00');

  const step: Step = STEPS[stepIndex];
  const { data: categories } = useQuery({ queryKey: queryKeys.categories, queryFn: api.categories, staleTime: 60 * 60_000 });

  // Same default as the web wizard: start with everything selected.
  useEffect(() => {
    if (categories && selected.length === 0) setSelected(categories.map((c) => c.name));
  }, [categories]);

  const minCategories = Math.min(MIN_CATEGORIES, categories?.length ?? MIN_CATEGORIES);

  const complete = useMutation({
    mutationFn: () => api.completeOnboarding({ categoryNames: selected, activeWindowStart: localHHMMToUtc(start), activeWindowEnd: localHHMMToUtc(end), acceptTrial: true }),
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The navigator swaps to the main tabs once `onboardingComplete` flips.
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t('onboarding.submitFailed')),
  });

  const canAdvance = (): string | null => {
    if (step === 'categories' && selected.length < minCategories) return t('categories.minError', { min: minCategories });
    if (step === 'trial' && !trialAccepted) return t('onboarding.trialRequired');
    if (step === 'window' && start === end) return t('onboarding.windowInvalid');
    return null;
  };

  const next = () => {
    const problem = canAdvance();
    if (problem) return toast.error(problem);
    if (step === 'finish') return complete.mutate();
    setStepIndex((i) => i + 1);
  };

  const sampleOptions = [t('onboarding.sample.o1'), t('onboarding.sample.o2'), t('onboarding.sample.o3'), t('onboarding.sample.o4')];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      {/* Progress */}
      <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS.length, now: stepIndex + 1 }} accessibilityLabel={t('onboarding.stepOf', { n: stepIndex + 1, total: STEPS.length })} style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressDot, i <= stepIndex && { backgroundColor: colors.brand }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'intro' && (
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('onboarding.introTitle')}
            </Text>
            <Text style={styles.subtitle}>{t('onboarding.introSubtitle')}</Text>
            {[
              { icon: '📬', title: t('onboarding.how1Title'), desc: t('onboarding.how1Desc') },
              { icon: '🧠', title: t('onboarding.how2Title'), desc: t('onboarding.how2Desc') },
              { icon: '🏆', title: t('onboarding.how3Title'), desc: t('onboarding.how3Desc') },
            ].map((h, i) => (
              <View key={h.title} style={styles.howCard}>
                <Text style={styles.howIcon}>{h.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.howTitle}>
                    {i + 1}. {h.title}
                  </Text>
                  <Text style={styles.howDesc}>{h.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {step === 'sample' && (
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('onboarding.sampleTitle')}
            </Text>
            <Text style={styles.subtitle}>{t('onboarding.sampleSubtitle')}</Text>
            <View style={styles.sampleCard}>
              <Text style={styles.sampleBadge}>EASY · {t('onboarding.sample.category')} · 10 pts</Text>
              <Text style={styles.sampleQuestion}>{t('onboarding.sample.question')}</Text>
              {sampleOptions.map((o, i) => {
                const answered = sampleChoice !== null;
                const isCorrect = answered && i === SAMPLE_CORRECT_INDEX;
                const isWrong = answered && i === sampleChoice && i !== SAMPLE_CORRECT_INDEX;
                return (
                  <TouchableOpacity
                    key={o}
                    accessibilityRole="button"
                    accessibilityLabel={`${o}${isCorrect ? `, ${t('drop.correctOption')}` : isWrong ? `, ${t('drop.yourWrongOption')}` : ''}`}
                    disabled={answered}
                    onPress={() => {
                      setSampleChoice(i);
                      Haptics.notificationAsync(i === SAMPLE_CORRECT_INDEX ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
                    }}
                    style={[styles.sampleOption, isCorrect && { borderColor: colors.success, backgroundColor: colors.success + '22' }, isWrong && { borderColor: colors.error, backgroundColor: colors.error + '22' }]}
                  >
                    <Text style={styles.sampleOptionText}>
                      {isCorrect ? '✓ ' : isWrong ? '✗ ' : ''}
                      {o}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {sampleChoice !== null && (
                <View accessibilityLiveRegion="polite" style={{ marginTop: 10 }}>
                  <Text style={[styles.howTitle, { color: sampleChoice === SAMPLE_CORRECT_INDEX ? colors.success : colors.error }]}>{sampleChoice === SAMPLE_CORRECT_INDEX ? t('onboarding.sampleCorrect') : t('onboarding.sampleIncorrect')}</Text>
                  <Text style={styles.howDesc}>{t('onboarding.sample.explanation')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {step === 'categories' && (
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('onboarding.categoriesTitle')}
            </Text>
            <Text style={styles.subtitle}>{t('onboarding.categoriesSubtitle', { min: minCategories })}</Text>
            {categories ? <CategoryPicker options={categories} selected={selected} onChange={setSelected} /> : <Skeleton height={320} />}
          </View>
        )}

        {step === 'trial' && (
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('onboarding.trialTitle')}
            </Text>
            <Text style={styles.subtitle}>{t('onboarding.trialSubtitle')}</Text>
            {[t('onboarding.trialPerk1'), t('onboarding.trialPerk2'), t('onboarding.trialPerk3')].map((p) => (
              <Text key={p} style={styles.perk}>
                ✓ {p}
              </Text>
            ))}
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: trialAccepted }} onPress={() => setTrialAccepted((v) => !v)} style={styles.checkboxRow}>
              <Feather name={trialAccepted ? 'check-square' : 'square'} size={22} color={trialAccepted ? colors.brand : colors.textSecondary} />
              <Text style={styles.checkboxText}>{t('onboarding.trialAccept')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'window' && (
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('onboarding.windowTitle')}
            </Text>
            <Text style={styles.subtitle}>{t('onboarding.windowSubtitle')}</Text>
            <View style={{ flexDirection: 'row' }}>
              <TimePickerField label={t('preferences.startTime')} value={start} onChange={setStart} />
              <View style={{ width: 12 }} />
              <TimePickerField label={t('preferences.endTime')} value={end} onChange={setEnd} />
            </View>
            <Text style={styles.howDesc}>{t('preferences.windowLocalHint', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}</Text>
          </View>
        )}

        {step === 'finish' && (
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('onboarding.finishTitle')}
            </Text>
            <Text style={styles.subtitle}>{t('onboarding.finishSubtitle')}</Text>
            <Text style={styles.perk}>• {t('onboarding.summaryCategories', { count: selected.length })}</Text>
            <Text style={styles.perk}>• {t('onboarding.summaryWindow', { start, end })}</Text>
            <Text style={styles.perk}>• {t('onboarding.summaryTrial')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {stepIndex > 0 ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setStepIndex((i) => i - 1)} style={styles.secondary} disabled={complete.isPending}>
            <Text style={styles.secondaryText}>{t('onboarding.back')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity accessibilityRole="button" onPress={() => logout()} style={styles.secondary}>
            <Text style={styles.secondaryText}>{t('profile.signOutConfirm')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: complete.isPending }} onPress={next} style={styles.primary} disabled={complete.isPending}>
          {complete.isPending ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{step === 'finish' ? t('onboarding.start') : step === 'sample' && sampleChoice === null ? t('onboarding.skip') : t('onboarding.next')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgPrimary },
    progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 8 },
    progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderColor },
    body: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 26, fontWeight: '900', color: colors.textPrimary },
    subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 6, marginBottom: 18, lineHeight: 21 },
    howCard: { flexDirection: 'row', gap: 12, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderColor, padding: 14, marginBottom: 10 },
    howIcon: { fontSize: 28 },
    howTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    howDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
    sampleCard: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brandSoft, padding: 16 },
    sampleBadge: { fontSize: 11, fontWeight: '700', color: colors.brand, marginBottom: 8 },
    sampleQuestion: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
    sampleOption: { borderWidth: 1, borderColor: colors.borderColor, borderRadius: radius.md, padding: 12, marginBottom: 8 },
    sampleOptionText: { fontSize: 15, color: colors.textPrimary },
    perk: { fontSize: 15, color: colors.textPrimary, marginBottom: 8 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, backgroundColor: colors.bgSecondary },
    checkboxText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
    primary: { flex: 2, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
    primaryText: { color: colors.onAccent, fontWeight: '800', fontSize: 16 },
    secondary: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.borderColor },
    secondaryText: { color: colors.textSecondary, fontWeight: '700', fontSize: 15 },
  });
