import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useToast } from '../components/toast';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';

import apiClient from '../api/client';

export default function Preferences({ navigation }: any) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

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
      theme: 'system',
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
    return <ActivityIndicator size='large' style={styles.loader} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>{t('preferences.windowHeader')}</Text>

      <View style={styles.row}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('preferences.startTime')}</Text>
          <TextInput style={styles.input} value={activeWindowStart} onChangeText={setActiveWindowStart} placeholder='09:00' />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('preferences.endTime')}</Text>
          <TextInput style={styles.input} value={activeWindowEnd} onChangeText={setActiveWindowEnd} placeholder='17:00' />
        </View>
      </View>

      <Text style={styles.header}>{t('preferences.diffHeader')}</Text>

      <View style={styles.inputGroupFull}>
        <Text style={styles.label}>{t('preferences.easyLabel')}</Text>
        <TextInput style={styles.input} value={easyWeight} onChangeText={setEasyWeight} keyboardType='numeric' />
      </View>

      <View style={styles.inputGroupFull}>
        <Text style={styles.label}>{t('preferences.mediumLabel')}</Text>
        <TextInput style={styles.input} value={mediumWeight} onChangeText={setMediumWeight} keyboardType='numeric' />
      </View>

      <View style={styles.inputGroupFull}>
        <Text style={styles.label}>{t('preferences.hardLabel')}</Text>
        <TextInput style={styles.input} value={hardWeight} onChangeText={setHardWeight} keyboardType='numeric' />
      </View>

      <View style={styles.buttonContainer}>
        <Button title={mutation.isPending ? t('preferences.saving') : t('preferences.save')} onPress={handleSave} disabled={mutation.isPending} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
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
    color: '#666',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom: 40,
  },
});
