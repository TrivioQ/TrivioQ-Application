import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/app-navigator';
import { useAuth } from '../context/auth-context';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/toast';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

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

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isPending} activeOpacity={0.8}>
            {isPending ? <ActivityIndicator color={colors.bgPrimary} /> : <Text style={styles.loginButtonText}>{t('auth.signInButton')}</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.orDivider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={isPending} activeOpacity={0.8}>
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
      borderRadius: 12,
      padding: 16,
      color: colors.textPrimary,
      fontSize: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.borderColor,
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
      color: '#fff',
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
      backgroundColor: colors.textPrimary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    googleButtonText: {
      color: colors.bgPrimary,
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
