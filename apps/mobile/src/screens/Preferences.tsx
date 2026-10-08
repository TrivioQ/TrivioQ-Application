import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { toast } from 'sonner-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { MIN_CATEGORIES, localHHMMToUtc, windowIsoToLocalHHMM, type NotificationPreferences } from '@trivioq/shared-types';
import { useTheme, Theme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { api, queryKeys, useMe } from '../api/queries';
import { TimePickerField } from '../components/time-picker-field';
import { CategoryPicker } from '../components/category-picker';
import { Skeleton } from '../components/ui';
import { PushNotificationSettings } from '../components/push-notification-settings';

const NOTIFICATION_TYPES: (keyof NotificationPreferences)[] = ['triviaDrop', 'streakReminder', 'socialActivity', 'subscriptionReminder', 'offerPromotion'];

export default function Preferences({ navigation }: any) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { theme, setTheme, colorScheme, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = colorScheme === 'dark';

  const { data: me, isLoading } = useMe();
  const { data: categories } = useQuery({ queryKey: queryKeys.categories, queryFn: api.categories, staleTime: 60 * 60_000 });
  const { data: notifPrefs } = useQuery({ queryKey: queryKeys.notificationPrefs, queryFn: api.notificationPrefs });

  const [displayName, setDisplayName] = useState('');
  const [activeWindowStart, setActiveWindowStart] = useState('09:00');
  const [activeWindowEnd, setActiveWindowEnd] = useState('17:00');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoriesTouched, setCategoriesTouched] = useState(false);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName ?? '');
    // The API stores the window in UTC; show it in the device's time zone.
    setActiveWindowStart(windowIsoToLocalHHMM(me.activeWindowStart, '09:00'));
    setActiveWindowEnd(windowIsoToLocalHHMM(me.activeWindowEnd, '17:00'));
    setSelectedCategories(Object.keys(me.preferences?.categoryPercentages ?? {}));
    if (me.preferences?.theme && me.preferences.theme !== theme) setTheme(me.preferences.theme as Theme);
  }, [me]);

  const minCategories = Math.min(MIN_CATEGORIES, categories?.length ?? MIN_CATEGORIES);

  const mutation = useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: () => {
      toast.success(t('preferences.successBody'));
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.today });
      navigation.goBack();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t('preferences.updateFailed')),
  });

  const notifMutation = useMutation({
    mutationFn: api.updateNotificationPrefs,
    onMutate: async (patch) => {
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKeys.notificationPrefs);
      queryClient.setQueryData(queryKeys.notificationPrefs, { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      queryClient.setQueryData(queryKeys.notificationPrefs, ctx?.previous);
      toast.error(t('preferences.updateFailed'));
    },
  });

  const handleSave = () => {
    const trimmedName = displayName.trim();
    if (trimmedName && (trimmedName.length < 2 || trimmedName.length > 50)) {
      toast.error(t('preferences.displayNameInvalid'));
      return;
    }
    if (categoriesTouched && selectedCategories.length < minCategories) {
      toast.error(t('categories.minError', { min: minCategories }));
      return;
    }

    // Only the fields this screen owns — the API merges them into the stored preferences.
    mutation.mutate({
      theme,
      activeWindowStart: localHHMMToUtc(activeWindowStart),
      activeWindowEnd: localHHMMToUtc(activeWindowEnd),
      ...(trimmedName ? { displayName: trimmedName } : {}),
      ...(categoriesTouched ? { categoryPercentages: Object.fromEntries(selectedCategories.map((n) => [n, 1 / selectedCategories.length])) } : {}),
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { gap: 12 }]}>
        <Skeleton height={60} />
        <Skeleton height={60} />
        <Skeleton height={200} />
      </View>
    );
  }

  const themes: { label: string; value: Theme; iconName: keyof typeof Feather.glyphMap }[] = [
    { label: t('common.light'), value: 'light', iconName: 'sun' },
    { label: t('common.dark'), value: 'dark', iconName: 'moon' },
    { label: t('common.system'), value: 'system', iconName: 'monitor' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={styles.glassCard}>
        <Text accessibilityRole="header" style={styles.header}>
          {t('common.theme')}
        </Text>
        <View accessibilityRole="radiogroup" style={styles.themeRow}>
          {themes.map((tItem) => {
            const isActive = theme === tItem.value;
            const FeatherIcon: any = Feather;
            return (
              <TouchableOpacity key={tItem.value} accessibilityRole="radio" accessibilityState={{ checked: isActive }} accessibilityLabel={tItem.label} style={[styles.themeButton, isActive && styles.themeButtonActive]} onPress={() => setTheme(tItem.value)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FeatherIcon name={tItem.iconName} size={16} color={isActive ? colors.brand : colors.textSecondary} />
                  <Text style={[styles.themeButtonText, isActive && styles.themeButtonTextActive]}>{tItem.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text accessibilityRole="header" style={styles.header}>
          {t('preferences.displayNameHeader')}
        </Text>
        <TextInput accessibilityLabel={t('preferences.displayNameHeader')} style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder={me?.username} placeholderTextColor={colors.textSecondary} maxLength={50} />

        <Text accessibilityRole="header" style={styles.header}>
          {t('preferences.windowHeader')}
        </Text>
        <View style={styles.row}>
          <TimePickerField label={t('preferences.startTime')} value={activeWindowStart} onChange={setActiveWindowStart} />
          <View style={{ width: 12 }} />
          <TimePickerField label={t('preferences.endTime')} value={activeWindowEnd} onChange={setActiveWindowEnd} />
        </View>
        <Text style={styles.hint}>{t('preferences.windowLocalHint', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}</Text>

        <Text accessibilityRole="header" style={styles.header}>
          {t('preferences.categoriesHeader')}
        </Text>
        {categories ? (
          <CategoryPicker
            options={categories}
            selected={selectedCategories}
            onChange={(names) => {
              setSelectedCategories(names);
              setCategoriesTouched(true);
            }}
          />
        ) : (
          <Skeleton height={200} />
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: mutation.isPending }} style={styles.saveButton} onPress={handleSave} disabled={mutation.isPending}>
            <Text style={styles.saveButtonText}>{mutation.isPending ? t('preferences.saving') : t('preferences.save')}</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      <View style={[styles.glassCard, { marginTop: 16, backgroundColor: colors.bgSecondary }]}>
        <Text accessibilityRole="header" style={[styles.header, { marginTop: 0 }]}>
          {t('preferences.notificationsHeader')}
        </Text>
        <PushNotificationSettings />
        {notifPrefs &&
          NOTIFICATION_TYPES.map((key) => (
            <View key={key} style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.switchLabel}>{t(`preferences.notif.${key}`)}</Text>
                <Text style={styles.switchSub}>{t(`preferences.notif.${key}Sub`)}</Text>
              </View>
              <Switch accessibilityLabel={t(`preferences.notif.${key}`)} value={!!notifPrefs[key]} onValueChange={(v) => notifMutation.mutate({ [key]: v })} trackColor={{ true: colors.brand, false: colors.borderColor }} />
            </View>
          ))}
        {notifPrefs && (
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.switchLabel}>{t('preferences.notif.email')}</Text>
              <Text style={styles.switchSub}>{t('preferences.notif.emailSub')}</Text>
            </View>
            <Switch accessibilityLabel={t('preferences.notif.email')} value={notifPrefs.enableEmailNotification} onValueChange={(v) => notifMutation.mutate({ enableEmailNotification: v })} trackColor={{ true: colors.brand, false: colors.borderColor }} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: 20,
      backgroundColor: colors.bgPrimary,
      flexGrow: 1,
    },
    glassCard: {
      padding: 20,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    header: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 20,
      marginBottom: 10,
      color: colors.textPrimary,
    },
    themeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    themeButton: {
      flex: 1,
      padding: 10,
      marginHorizontal: 5,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderColor,
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
    },
    themeButtonActive: {
      borderColor: colors.brand,
      backgroundColor: colors.brandFaint,
    },
    themeButtonText: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    themeButtonTextActive: {
      color: colors.brand,
    },
    row: {
      flexDirection: 'row',
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderRadius: radius.md,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.bgSecondary,
      color: colors.textPrimary,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderColor,
    },
    switchLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    switchSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    buttonContainer: {
      marginTop: 30,
      marginBottom: 10,
    },
    saveButton: {
      backgroundColor: colors.brand,
      padding: 15,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 4,
    },
    saveButtonText: {
      color: colors.onAccent,
      fontWeight: 'bold',
      fontSize: 16,
    },
  });
