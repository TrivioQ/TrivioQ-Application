import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/auth-context';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

export default function SignupScreen({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const { t } = useTranslation();
  const { registerWithEmail } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !username || !dateOfBirth) {
      toast.error(t('auth.signupMissingFields'));
      return;
    }

    // Validate date format YYYY-MM-DD
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dateOfBirth)) {
      toast.error(t('auth.invalidDateFormat'));
      return;
    }

    const dobParts = dateOfBirth.split('-');
    const dobYear = parseInt(dobParts[0], 10);
    const dobMonth = parseInt(dobParts[1], 10);
    const dobDay = parseInt(dobParts[2], 10);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    let age = currentYear - dobYear;
    if (currentMonth < dobMonth || (currentMonth === dobMonth && currentDay < dobDay)) {
      age--;
    }

    if (age < 13) {
      toast.error(t('auth.ageTooYoung'));
      return;
    }

    setIsPending(true);
    try {
      await registerWithEmail(email, password, username, displayName || username, dateOfBirth, referralCode || undefined);
      toast.success('Successfully registered');
    } catch (error: any) {
      console.error('Signup failed:', error);
      toast.error(error.message || t('auth.signupFailed'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logoText}>
            Trivio<Text style={styles.logoAccent}>Q</Text>
          </Text>
          <Text style={styles.subtitle}>{t('auth.signupSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.displayNameLabel')}</Text>
          <TextInput style={styles.input} placeholder={t('auth.displayNamePlaceholder')} placeholderTextColor={colors.textSecondary} value={displayName} onChangeText={setDisplayName} />

          <Text style={styles.label}>{t('auth.usernameLabel')}</Text>
          <TextInput style={styles.input} placeholder={t('auth.usernamePlaceholder')} placeholderTextColor={colors.textSecondary} value={username} onChangeText={(v) => setUsername(v.toLowerCase())} autoCapitalize="none" />

          <Text style={styles.label}>{t('auth.emailLabel')}</Text>
          <TextInput style={styles.input} placeholder="email@example.com" placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
          <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.label}>{t('auth.dateOfBirthLabel')}</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} value={dateOfBirth} onChangeText={setDateOfBirth} keyboardType="numbers-and-punctuation" maxLength={10} />
          <Text style={styles.hint}>{t('auth.dateOfBirthHint')}</Text>

          <Text style={styles.label}>{t('auth.referralCodeLabel')}</Text>
          <TextInput style={styles.input} placeholder={t('auth.referralCodePlaceholder')} placeholderTextColor={colors.textSecondary} value={referralCode} onChangeText={setReferralCode} autoCapitalize="none" />

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup} disabled={isPending} activeOpacity={0.8}>
            {isPending ? <ActivityIndicator color={colors.bgPrimary} /> : <Text style={styles.signupButtonText}>{t('auth.createButton')}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('auth.hasAccount')}{' '}
            <Text style={styles.footerLink} onPress={onNavigateToLogin}>
              {t('auth.signInLink')}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logoText: {
      fontSize: 42,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    logoAccent: {
      color: colors.brand,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
      fontWeight: '500',
    },
    form: {
      width: '100%',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
      marginLeft: 4,
    },
    input: {
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      padding: 16,
      color: colors.textPrimary,
      fontSize: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: -16,
      marginBottom: 20,
      marginLeft: 4,
    },
    signupButton: {
      backgroundColor: colors.brand,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    signupButtonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: '700',
    },
    footer: {
      marginTop: 40,
      alignItems: 'center',
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    footerLink: {
      color: colors.brand,
      fontWeight: '700',
    },
  });
