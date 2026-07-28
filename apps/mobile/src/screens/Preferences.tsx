import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { toast } from 'sonner-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import { useTheme, Theme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';

import apiClient from '../api/client';

export default function Preferences({ navigation }: any) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { theme, setTheme, colorScheme, colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const isDark = colorScheme === 'dark';

  const [activeWindowStart, setActiveWindowStart] = useState('09:00');
  const [activeWindowEnd, setActiveWindowEnd] = useState('17:00');
  // TEMPORARILY HIDDEN: difficulty selection is locked to fixed defaults for all users (Easy:20%, Medium:70%, Hard:10%)
  const [easyWeight] = useState('0.2');
  const [mediumWeight] = useState('0.7');
  const [hardWeight] = useState('0.1');

  const { data, isLoading } = useQuery({
    queryKey: ['userMe', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me');
      return response.data;
    },
  });

  useEffect(() => {
    if (data) {
      if (data.activeWindowStart) {
        const d = new Date(data.activeWindowStart);
        setActiveWindowStart(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`);
      }
      if (data.activeWindowEnd) {
        const d = new Date(data.activeWindowEnd);
        setActiveWindowEnd(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`);
      }
      // TEMPORARILY HIDDEN: difficulty weights are ignored from server, fixed defaults are used
      if (data.preferences?.theme && data.preferences.theme !== theme) {
        setTheme(data.preferences.theme as Theme);
      }
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (newPreferences: any) => {
      try {
        const response = await apiClient.put('/api/v1/users/preferences', newPreferences);
        return response.data;
      } catch (err: any) {
        throw new Error(err.response?.data?.error || 'Failed to update preferences');
      }
    },
    onSuccess: () => {
      toast.success(`${t('preferences.successTitle')}: ${t('preferences.successBody')}`);
      queryClient.invalidateQueries({ queryKey: ['userMe'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    const e = parseFloat(easyWeight);
    const m = parseFloat(mediumWeight);
    const h = parseFloat(hardWeight);

    if (isNaN(e) || isNaN(m) || isNaN(h)) {
      toast.error(t('preferences.validationError'));
      return;
    }

    const payload = {
      theme: theme,
      notificationsEnabled: true,
      language: 'en',
      activeWindowStart,
      activeWindowEnd,
      targetDropsPerWeek: 5,
      categoryPercentages: {
        easy: e,
        medium: m,
        hard: h,
      },
    };

    mutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const themes: { label: string; value: Theme; iconName: keyof typeof Feather.glyphMap }[] = [
    { label: 'Light', value: 'light', iconName: 'sun' },
    { label: 'Dark', value: 'dark', iconName: 'moon' },
    { label: 'System', value: 'system', iconName: 'monitor' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={styles.glassCard}>
        <Text style={styles.header}>App Theme</Text>
        <View style={styles.themeRow}>
          {themes.map((tItem) => {
            const isActive = theme === tItem.value;
            const FeatherIcon: any = Feather;
            return (
              <TouchableOpacity key={tItem.value} style={[styles.themeButton, isActive && styles.themeButtonActive]} onPress={() => setTheme(tItem.value)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FeatherIcon name={tItem.iconName} size={16} color={isActive ? colors.brand : colors.textSecondary} />
                  <Text style={[styles.themeButtonText, isActive && styles.themeButtonTextActive]}>{tItem.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.header}>{t('preferences.windowHeader')}</Text>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('preferences.startTime')}</Text>
            <TextInput style={styles.input} value={activeWindowStart} onChangeText={setActiveWindowStart} placeholder="09:00" placeholderTextColor={colors.textSecondary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('preferences.endTime')}</Text>
            <TextInput style={styles.input} value={activeWindowEnd} onChangeText={setActiveWindowEnd} placeholder="17:00" placeholderTextColor={colors.textSecondary} />
          </View>
        </View>

        {/* Difficulty weights — TEMPORARILY HIDDEN for all users; fixed defaults (Easy:20%, Medium:70%, Hard:10%) are sent silently */}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={mutation.isPending}>
            <Text style={styles.saveButtonText}>{mutation.isPending ? t('preferences.saving') : t('preferences.save')}</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
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
      justifyContent: 'space-between',
    },
    inputGroup: {
      width: '48%',
    },
    inputGroupFull: {
      width: '100%',
      marginBottom: 15,
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 5,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      backgroundColor: colors.bgSecondary,
      color: colors.textPrimary,
    },
    buttonContainer: {
      marginTop: 30,
      marginBottom: 40,
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
