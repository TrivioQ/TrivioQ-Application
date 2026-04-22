import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

import apiClient from '../api/client';

export default function HomeDashboard({ navigation }: any) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);

  const onDemandMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/v1/drops/on-demand');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeDrop'] });
      navigation.navigate('DropActive');
    },
    onError: (err: any) => {
      if (err.response?.data?.code === 'UPGRADE_REQUIRED') {
        setIsPaywallVisible(true);
      } else {
        console.error('Failed to request drop:', err.response?.data || err.message);
      }
    },
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['userMe', userId],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me');
      return response.data;
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Trivioq!</Text>
      <Text style={styles.subtitle}>Your daily trivia drops await.</Text>

      {isLoading ? (
        <ActivityIndicator size='large' color='#0000ff' style={styles.loader} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load metrics</Text>
          <Button title='Retry' onPress={() => refetch()} />
        </View>
      ) : (
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>🔥 {data.currentStreak}</Text>
            <Text style={styles.metricLabel}>Current Streak</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>🏆 {data.cumulativeScore}</Text>
            <Text style={styles.metricLabel}>Total Score</Text>
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button title='Edit Preferences' onPress={() => navigation.navigate('Preferences')} />
        <View style={{ height: 15 }} />
        <Button title='Go to Active Drop' onPress={() => navigation.navigate('DropActive')} />
        <View style={{ height: 15 }} />
        <Button title={onDemandMutation.isPending ? 'Requesting...' : 'Request Next Question'} onPress={() => onDemandMutation.mutate()} disabled={onDemandMutation.isPending} color='#9b59b6' />
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  loader: {
    marginVertical: 40,
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 50,
  },
  metricCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    width: '80%',
    marginTop: 'auto',
    marginBottom: 40,
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
