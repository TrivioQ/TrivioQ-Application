import React, { useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/auth-context';
import { radius } from '../theme/radius';
import { api, queryKeys } from '../api/queries';

/** Google "G" logo per brand guidelines */
export function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const compact = (n: number) => `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}+`;

/** "Join 1.2K+ learners · 50K+ questions answered" from the public /v1/stats. */
export function SocialProof() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data } = useQuery({ queryKey: queryKeys.stats, queryFn: api.stats, staleTime: 60 * 60_000, retry: false });
  if (!data || data.activeLearners === 0) return null;
  return <Text style={{ textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>{t('auth.socialProof', { learners: compact(data.activeLearners), answered: compact(data.questionsAnswered) })}</Text>;
}

/** Email prompt that sends a Firebase password-reset email. */
export function ForgotPasswordModal({ visible, initialEmail, onClose }: { visible: boolean; initialEmail: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error(t('auth.invalidEmail'));
    setSending(true);
    try {
      await sendPasswordReset(email.trim());
    } catch (err: any) {
      // Don't reveal whether the address has an account; only surface rate limits.
      if (err?.code === 'auth/too-many-requests') {
        toast.error(t('account.tooManyRequests'));
        setSending(false);
        return;
      }
    }
    setSending(false);
    toast.success(t('auth.resetSent'));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => setEmail(initialEmail)}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.xl, padding: 22 }}>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>
            {t('auth.forgotPasswordTitle')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: 14 }}>{t('auth.forgotPasswordBody')}</Text>
          <TextInput
            accessibilityLabel={t('auth.emailLabel')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={{ borderWidth: 1, borderColor: colors.borderColor, borderRadius: radius.md, padding: 12, fontSize: 16, color: colors.textPrimary, backgroundColor: colors.bgPrimary }}
          />
          <TouchableOpacity accessibilityRole="button" onPress={handleSend} disabled={sending} style={{ marginTop: 16, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' }}>
            {sending ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 15 }}>{t('auth.sendResetLink')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
