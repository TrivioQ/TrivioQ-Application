import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

type LegalDoc = { title: string; content: string; version: string; updatedAt: string };

export default function TermsScreen() {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);

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
        <ActivityIndicator color={colors.brand} style={styles.loader} />
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
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
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

const createMarkdownStyles = (colors: ThemeColors) => ({
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: colors.bgPrimary,
  },
  heading1: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  heading2: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 24,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
    paddingTop: 20,
  },
  strong: {
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  link: {
    color: colors.brand,
  },
  list_item: {
    color: colors.textSecondary,
  },
  bullet_list_icon: {
    color: colors.brand,
  },
  paragraph: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  hr: {
    backgroundColor: colors.borderColor,
    height: 1,
  },
});
