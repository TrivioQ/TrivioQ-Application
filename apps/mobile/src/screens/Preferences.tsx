import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';

import apiClient from '../api/client';

export default function Preferences({ navigation }: any) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

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
    if (data?.preferences) {
      const p = data.preferences;
      if (p.activeWindowStart) setActiveWindowStart(p.activeWindowStart);
      if (p.activeWindowEnd) setActiveWindowEnd(p.activeWindowEnd);
      if (p.categoryPercentages) {
        setEasyWeight((p.categoryPercentages.easy || 0.5).toString());
        setMediumWeight((p.categoryPercentages.medium || 0.3).toString());
        setHardWeight((p.categoryPercentages.hard || 0.2).toString());
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
      Alert.alert('Success', 'Preferences updated!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      queryClient.invalidateQueries({ queryKey: ['userMe'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSave = () => {
    const e = parseFloat(easyWeight);
    const m = parseFloat(mediumWeight);
    const h = parseFloat(hardWeight);

    if (isNaN(e) || isNaN(m) || isNaN(h)) {
      Alert.alert('Error', 'Weights must be valid numeric decimals (e.g. 0.5)');
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
      <Text style={styles.header}>Active Window (HH:MM)</Text>

      <View style={styles.row}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Time</Text>
          <TextInput style={styles.input} value={activeWindowStart} onChangeText={setActiveWindowStart} placeholder='09:00' />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>End Time</Text>
          <TextInput style={styles.input} value={activeWindowEnd} onChangeText={setActiveWindowEnd} placeholder='17:00' />
        </View>
      </View>

      <Text style={styles.header}>Difficulty Distribution (Must equal 1.0)</Text>

      <View style={styles.inputGroupFull}>
        <Text style={styles.label}>Easy Percentage (e.g. 0.5)</Text>
        <TextInput style={styles.input} value={easyWeight} onChangeText={setEasyWeight} keyboardType='numeric' />
      </View>

      <View style={styles.inputGroupFull}>
        <Text style={styles.label}>Medium Percentage (e.g. 0.3)</Text>
        <TextInput style={styles.input} value={mediumWeight} onChangeText={setMediumWeight} keyboardType='numeric' />
      </View>

      <View style={styles.inputGroupFull}>
        <Text style={styles.label}>Hard Percentage (e.g. 0.2)</Text>
        <TextInput style={styles.input} value={hardWeight} onChangeText={setHardWeight} keyboardType='numeric' />
      </View>

      <View style={styles.buttonContainer}>
        <Button title={mutation.isPending ? 'Saving...' : 'Save Preferences'} onPress={handleSave} disabled={mutation.isPending} />
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
