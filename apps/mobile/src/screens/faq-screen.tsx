import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, LayoutAnimation, Platform, UIManager, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import apiClient from '../api/client';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

// ─── Accordion Item ───────────────────────────────────────────────────────────

function FAQAccordionItem({ item, styles }: { item: FAQItem; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <TouchableOpacity style={styles.accordionItem} activeOpacity={0.85} onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded }}>
      <View style={styles.accordionHeader}>
        <Text style={styles.accordionQuestion}>{item.question}</Text>
        <Text style={[styles.accordionChevron, expanded && styles.accordionChevronOpen]}>›</Text>
      </View>
      {expanded && (
        <>
          <View style={styles.accordionDivider} />
          <Text style={styles.accordionAnswer}>{item.answer}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FaqScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: faqs,
    isLoading,
    error,
  } = useQuery<FAQItem[]>({
    queryKey: ['faqs'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/faqs');
      return response.data;
    },
  });

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@trivioq.com');
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('faq.error')}</Text>
      </View>
    );
  }

  const items = faqs ?? [];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('faq.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('faq.subtitle')}</Text>
        </View>
      }
      renderItem={({ item }) => <FAQAccordionItem item={item} colors={colors} styles={styles} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('faq.noFaqs')}</Text>
        </View>
      }
      ListFooterComponent={
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>{t('faq.stillHaveQuestions')}</Text>
          <Text style={styles.contactDesc}>{t('faq.contactDesc')}</Text>
          <TouchableOpacity style={styles.contactButton} activeOpacity={0.85} onPress={handleContactSupport} accessibilityRole="button" accessibilityLabel={t('faq.contactSupport')}>
            <Text style={styles.contactButtonText}>{t('faq.contactSupport')}</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    contentContainer: {
      paddingBottom: 40,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgPrimary,
      padding: 24,
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
      textAlign: 'center',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 20,
      alignItems: 'center',
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    heroSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },

    // ── Accordion ─────────────────────────────────────────────────────────────
    accordionItem: {
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.bgSecondary,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
      overflow: 'hidden',
      padding: 16,
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accordionQuestion: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      lineHeight: 22,
      paddingRight: 12,
    },
    accordionChevron: {
      fontSize: 22,
      color: colors.textSecondary,
      transform: [{ rotate: '90deg' }],
    },
    accordionChevronOpen: {
      transform: [{ rotate: '270deg' }],
      color: colors.brand,
    },
    accordionDivider: {
      height: 1,
      backgroundColor: colors.borderColor,
      marginVertical: 12,
    },
    accordionAnswer: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
    },

    // ── Empty ─────────────────────────────────────────────────────────────────
    emptyContainer: {
      paddingVertical: 40,
      alignItems: 'center',
      marginHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderStyle: 'dashed',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 15,
    },

    // ── Contact Card ──────────────────────────────────────────────────────────
    contactCard: {
      marginHorizontal: 16,
      marginTop: 28,
      padding: 24,
      borderRadius: 20,
      backgroundColor: colors.bgSecondary,
      borderWidth: 1,
      borderColor: colors.borderColor,
      alignItems: 'center',
    },
    contactTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    contactDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    contactButton: {
      backgroundColor: colors.brand,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 14,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    contactButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
