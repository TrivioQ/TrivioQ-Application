import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ForgotPasswordModal, GoogleG, SocialProof } from '../components/auth-extras';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/app-navigator';
import { useAuth } from '../context/auth-context';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { loginWithEmail, signInWithGoogle } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error(t('auth.missingFields'));
      return;
    }

    setIsPending(true);
    try {
      await loginWithEmail(email, password);
      toast.success(t('auth.loginSuccess'));
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.message || t('auth.loginFailed'));
    } finally {
      setIsPending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsPending(true);
    try {
      await signInWithGoogle();
      toast.success(t('auth.loginSuccess'));
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      toast.error(error.message || t('auth.googleFailed'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.logoText}>
            Trivio<Text style={styles.logoAccent}>Q</Text>
          </Text>
          <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
          <SocialProof />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.emailLabel')}</Text>
          <TextInput accessibilityLabel={t('auth.emailLabel')} autoComplete="email" style={styles.input} placeholder={t('auth.emailPlaceholder')} placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
          <TextInput accessibilityLabel={t('auth.passwordLabel')} autoComplete="current-password" style={styles.input} placeholder={t('auth.passwordPlaceholder')} placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />

          {/* Forgot password link */}
          <TouchableOpacity accessibilityRole="button" style={styles.forgotPasswordRow} onPress={() => setForgotOpen(true)}>
            <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.signInButton')} style={styles.loginButton} onPress={handleLogin} disabled={isPending} activeOpacity={0.8}>
            {isPending ? <ActivityIndicator color={colors.bgPrimary} /> : <Text style={styles.loginButtonText}>{t('auth.signInButton')}</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.orDivider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('auth.googleButton')} style={styles.googleButton} onPress={handleGoogleSignIn} disabled={isPending} activeOpacity={0.8}>
            <GoogleG />
            <Text style={styles.googleButtonText}>{t('auth.googleButton')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('auth.noAccount')}
            <Text accessibilityRole="link" style={styles.footerLink} onPress={() => navigation.navigate('Signup')}>
              {t('auth.signUpLink')}
            </Text>
          </Text>
        </View>
      </ScrollView>
      <ForgotPasswordModal visible={forgotOpen} initialEmail={email} onClose={() => setForgotOpen(false)} />
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
      marginBottom: 48,
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
      borderRadius: radius.md,
      padding: 16,
      color: colors.textPrimary,
      fontSize: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    forgotPasswordRow: {
      alignSelf: 'flex-end',
      marginBottom: 20,
      marginTop: 2,
    },
    forgotPasswordText: {
      color: colors.brand,
      fontSize: 13,
      fontWeight: '600',
    },
    loginButton: {
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
    loginButtonText: {
      color: colors.onAccent,
      fontSize: 16,
      fontWeight: '700',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 32,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.borderColor,
    },
    dividerText: {
      color: colors.textSecondary,
      paddingHorizontal: 16,
      fontSize: 12,
      fontWeight: '700',
    },
    googleButton: {
      backgroundColor: '#FFFFFF', // vendor-locked — Google brand compliance
      borderRadius: radius.md,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: '#E5E7EB', // vendor-locked
      shadowColor: colors.overlay,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    googleButtonText: {
      color: '#1F2937', // vendor-locked
      fontSize: 16,
      fontWeight: '700',
    },
    footer: {
      marginTop: 48,
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
