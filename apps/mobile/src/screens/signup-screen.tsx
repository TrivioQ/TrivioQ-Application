import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/auth-context';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/toast';

export default function SignupScreen({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const { t } = useTranslation();
  const { registerWithEmail } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !username || !dateOfBirth) {
      toast({ message: t('auth.signupMissingFields'), type: 'error' });
      return;
    }

    // Validate date format YYYY-MM-DD
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dateOfBirth)) {
      toast({ message: t('auth.invalidDateFormat'), type: 'error' });
      return;
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      toast({ message: t('auth.invalidDateFormat'), type: 'error' });
      return;
    }

    const minAgeDate = new Date();
    minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);
    if (dob > minAgeDate) {
      toast({ message: t('auth.ageTooYoung'), type: 'error' });
      return;
    }

    setIsPending(true);
    try {
      await registerWithEmail(email, password, username, displayName || username, dateOfBirth, referralCode || undefined);
    } catch (error: any) {
      console.error('Signup failed:', error);
      toast({ message: error.message || t('auth.signupFailed'), type: 'error' });
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
          <TextInput style={styles.input} placeholder={t('auth.displayNamePlaceholder')} placeholderTextColor="#64748b" value={displayName} onChangeText={setDisplayName} />

          <Text style={styles.label}>{t('auth.usernameLabel')}</Text>
          <TextInput style={styles.input} placeholder={t('auth.usernamePlaceholder')} placeholderTextColor="#64748b" value={username} onChangeText={(v) => setUsername(v.toLowerCase())} autoCapitalize="none" />

          <Text style={styles.label}>{t('auth.emailLabel')}</Text>
          <TextInput style={styles.input} placeholder="email@example.com" placeholderTextColor="#64748b" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
          <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#64748b" value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.label}>{t('auth.dateOfBirthLabel')}</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#64748b" value={dateOfBirth} onChangeText={setDateOfBirth} keyboardType="numbers-and-punctuation" maxLength={10} />
          <Text style={styles.hint}>{t('auth.dateOfBirthHint')}</Text>

          <Text style={styles.label}>{t('auth.referralCodeLabel')}</Text>
          <TextInput style={styles.input} placeholder={t('auth.referralCodePlaceholder')} placeholderTextColor="#64748b" value={referralCode} onChangeText={setReferralCode} autoCapitalize="none" />

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup} disabled={isPending} activeOpacity={0.8}>
            {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupButtonText}>{t('auth.createButton')}</Text>}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    color: '#fff',
    letterSpacing: -1,
  },
  logoAccent: {
    color: '#6366f1',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -16,
    marginBottom: 20,
    marginLeft: 4,
  },
  signupButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  footerLink: {
    color: '#6366f1',
    fontWeight: '700',
  },
});
