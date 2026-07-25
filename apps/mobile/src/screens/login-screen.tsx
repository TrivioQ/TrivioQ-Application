import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/app-navigator';
import { useAuth } from '../context/auth-context';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/toast';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';

/** Google "G" logo per brand guidelines */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const { loginWithEmail, signInWithGoogle } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast({ message: t('auth.missingFields'), type: 'error' });
      return;
    }

    setIsPending(true);
    try {
      await loginWithEmail(email, password);
    } catch (error: any) {
      console.error('Login failed:', error);
      toast({ message: error.message || t('auth.loginFailed'), type: 'error' });
    } finally {
      setIsPending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsPending(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      toast({ message: error.message || t('auth.googleFailed'), type: 'error' });
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
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.emailLabel')}</Text>
          <TextInput style={styles.input} placeholder="email@example.com" placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

          <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
          <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />

          {/* Forgot password link */}
          <TouchableOpacity style={styles.forgotPasswordRow} onPress={() => Alert.alert(t('auth.forgotPasswordTitle'), t('auth.forgotPasswordBody'))}>
            <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isPending} activeOpacity={0.8}>
            {isPending ? <ActivityIndicator color={colors.bgPrimary} /> : <Text style={styles.loginButtonText}>{t('auth.signInButton')}</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.orDivider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={isPending} activeOpacity={0.8}>
            <GoogleG />
            <Text style={styles.googleButtonText}>{t('auth.googleButton')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('auth.noAccount')}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('Signup')}>
              {t('auth.signUpLink')}
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
