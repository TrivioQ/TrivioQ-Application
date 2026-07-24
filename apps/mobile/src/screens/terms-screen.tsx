import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';
import apiClient from '../api/client';

type LegalDoc = { title: string; content: string; version: string; updatedAt: string };

export default function TermsScreen() {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<LegalDoc>('/v1/legal/terms')
      .then((res) => setDoc(res.data))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading ? (
        <ActivityIndicator color="#14B8A6" style={styles.loader} />
      ) : doc ? (
        <Markdown style={markdownStyles}>{doc.content}</Markdown>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Terms of Service is currently unavailable. Please try again later.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  loader: {
    marginTop: 60,
  },
  errorContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
});

const markdownStyles = {
  body: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: '#0f172a',
  },
  heading1: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  heading2: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 24,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 20,
  },
  strong: {
    color: '#cbd5e1',
    fontWeight: '600' as const,
  },
  link: {
    color: '#14B8A6',
  },
  list_item: {
    color: '#94a3b8',
  },
  bullet_list_icon: {
    color: '#14B8A6',
  },
  paragraph: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  hr: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    height: 1,
  },
};
