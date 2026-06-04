import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useToast } from '../components/toast';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import { useTheme, Theme } from '../context/ThemeContext';
import { BlurView } from 'expo-blur';

import apiClient from '../api/client';

export default function Preferences({ navigation }: any) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { theme, setTheme, colorScheme } = useTheme();

  const isDark = colorScheme === 'dark';

  const [activeWindowStart, setActiveWindowStart] = useState('09:00');
  const [activeWindowEnd, setActiveWindowEnd] = useState('17:00');
  const [easyWeight, setEasyWeight] = useState('0.5');
  const [mediumWeight, setMediumWeight] = useState('0.3');
  const [hardWeight, setHardWeight] = useState('0.2');

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
      if (data.preferences?.categoryPercentages) {
        const p = data.preferences.categoryPercentages;
        setEasyWeight((p.easy || 0.5).toString());
        setMediumWeight((p.medium || 0.3).toString());
        setHardWeight((p.hard || 0.2).toString());
      }
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
      toast({ message: `${t('preferences.successTitle')}: ${t('preferences.successBody')}`, type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['userMe'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      toast({ message: error.message, type: 'error' });
    },
  });

  const handleSave = () => {
    const e = parseFloat(easyWeight);
    const m = parseFloat(mediumWeight);
    const h = parseFloat(hardWeight);

    if (isNaN(e) || isNaN(m) || isNaN(h)) {
      toast({ message: t('preferences.validationError'), type: 'error' });
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
      <View style={[styles.container, isDark && styles.containerDark]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const themes: { label: string; value: Theme }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  const SafeBlurView = BlurView as any;

  return (
    <ScrollView contentContainerStyle={[styles.container, isDark && styles.containerDark]}>
      <SafeBlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={styles.glassCard}>
        <Text style={[styles.header, isDark && styles.textDark]}>App Theme</Text>
        <View style={styles.themeRow}>
          {themes.map((tItem) => (
            <TouchableOpacity key={tItem.value} style={[styles.themeButton, theme === tItem.value && styles.themeButtonActive, isDark && styles.themeButtonDark]} onPress={() => setTheme(tItem.value)}>
              <Text style={[styles.themeButtonText, theme === tItem.value && styles.themeButtonTextActive, isDark && !theme && styles.textDark]}>{tItem.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.header, isDark && styles.textDark]}>{t('preferences.windowHeader')}</Text>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>{t('preferences.startTime')}</Text>
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={activeWindowStart} onChangeText={setActiveWindowStart} placeholder="09:00" placeholderTextColor={isDark ? '#888' : '#999'} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>{t('preferences.endTime')}</Text>
            <TextInput style={[styles.input, isDark && styles.inputDark]} value={activeWindowEnd} onChangeText={setActiveWindowEnd} placeholder="17:00" placeholderTextColor={isDark ? '#888' : '#999'} />
          </View>
        </View>

        <Text style={[styles.header, isDark && styles.textDark]}>{t('preferences.diffHeader')}</Text>

        <View style={styles.inputGroupFull}>
          <Text style={[styles.label, isDark && styles.labelDark]}>{t('preferences.easyLabel')}</Text>
          <TextInput style={[styles.input, isDark && styles.inputDark]} value={easyWeight} onChangeText={setEasyWeight} keyboardType="numeric" />
        </View>

        <View style={styles.inputGroupFull}>
          <Text style={[styles.label, isDark && styles.labelDark]}>{t('preferences.mediumLabel')}</Text>
          <TextInput style={[styles.input, isDark && styles.inputDark]} value={mediumWeight} onChangeText={setMediumWeight} keyboardType="numeric" />
        </View>

        <View style={styles.inputGroupFull}>
          <Text style={[styles.label, isDark && styles.labelDark]}>{t('preferences.hardLabel')}</Text>
          <TextInput style={[styles.input, isDark && styles.inputDark]} value={hardWeight} onChangeText={setHardWeight} keyboardType="numeric" />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={mutation.isPending}>
            <Text style={styles.saveButtonText}>{mutation.isPending ? t('preferences.saving') : t('preferences.save')}</Text>
          </TouchableOpacity>
        </View>
      </SafeBlurView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F3F4F6', // Light gray background to show off glass
    flexGrow: 1,
  },
  containerDark: {
    backgroundColor: '#111827', // Deep dark blue for dark mode
  },
  glassCard: {
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#1F2937',
  },
  textDark: {
    color: '#F9FAFB',
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
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  themeButtonDark: {
    borderColor: '#4B5563',
    backgroundColor: 'rgba(31,41,55,0.5)',
  },
  themeButtonActive: {
    borderColor: '#3B82F6', // Blue accent
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  themeButtonText: {
    color: '#4B5563',
    fontWeight: '600',
  },
  themeButtonTextActive: {
    color: '#3B82F6',
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
    color: '#4B5563',
    marginBottom: 5,
  },
  labelDark: {
    color: '#D1D5DB',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    color: '#1F2937',
  },
  inputDark: {
    borderColor: '#4B5563',
    backgroundColor: 'rgba(31,41,55,0.7)',
    color: '#F9FAFB',
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom: 40,
  },
  saveButton: {
    backgroundColor: '#3B82F6', // Vibrant blue
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
