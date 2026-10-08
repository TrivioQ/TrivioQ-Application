import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { toast } from 'sonner-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { useConfirm } from '../components/confirm-modal';

const firebaseMessage = (err: any, fallback: string, t: (k: string) => string) => {
  const code: string | undefined = err?.code;
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return t('account.wrongPassword');
  if (code === 'auth/weak-password') return t('account.weakPassword');
  if (code === 'auth/too-many-requests') return t('account.tooManyRequests');
  return err?.response?.data?.error || fallback;
};

export default function AccountScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isEmailUser, changePassword, deleteAccount } = useAuth();
  const confirm = useConfirm();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = async () => {
    if (next.length < 8) return toast.error(t('account.weakPassword'));
    if (next !== confirmNext) return toast.error(t('account.mismatch'));
    setSaving(true);
    try {
      await changePassword(current, next);
      toast.success(t('account.passwordUpdated'));
      setCurrent('');
      setNext('');
      setConfirmNext('');
    } catch (err) {
      toast.error(firebaseMessage(err, t('account.passwordFailed'), t));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: t('account.deleteTitle'), message: t('account.deleteBody'), confirmLabel: t('account.deleteConfirm'), isDestructive: true });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success(t('account.deleted'));
    } catch (err) {
      toast.error(firebaseMessage(err, t('account.deleteFailed'), t));
      setDeleting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.email}>{user?.email}</Text>

      {isEmailUser ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.header}>
            {t('account.changePassword')}
          </Text>
          <TextInput accessibilityLabel={t('account.currentPassword')} style={styles.input} placeholder={t('account.currentPassword')} placeholderTextColor={colors.textSecondary} secureTextEntry value={current} onChangeText={setCurrent} autoComplete="current-password" />
          <TextInput accessibilityLabel={t('account.newPassword')} style={styles.input} placeholder={t('account.newPassword')} placeholderTextColor={colors.textSecondary} secureTextEntry value={next} onChangeText={setNext} autoComplete="new-password" />
          <TextInput accessibilityLabel={t('account.confirmPassword')} style={styles.input} placeholder={t('account.confirmPassword')} placeholderTextColor={colors.textSecondary} secureTextEntry value={confirmNext} onChangeText={setConfirmNext} autoComplete="new-password" />
          <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={handleChangePassword} disabled={saving || !current || !next}>
            {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{t('account.updatePassword')}</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.muted}>{t('account.socialSignIn')}</Text>
        </View>
      )}

      <View style={[styles.card, styles.dangerCard]}>
        <Text accessibilityRole="header" style={[styles.header, { color: colors.error }]}>
          {t('account.dangerZone')}
        </Text>
        <Text style={styles.muted}>{t('account.deleteHelp')}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.danger} onPress={handleDelete} disabled={deleting}>
          {deleting ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{t('account.deleteAccount')}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { padding: 20, backgroundColor: colors.bgPrimary, flexGrow: 1, gap: 16 },
    email: { fontSize: 14, color: colors.textSecondary },
    card: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderColor, padding: 16, gap: 10 },
    dangerCard: { borderColor: colors.error + '60' },
    header: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    input: { borderWidth: 1, borderColor: colors.borderColor, borderRadius: radius.md, padding: 12, fontSize: 16, backgroundColor: colors.bgPrimary, color: colors.textPrimary },
    primary: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
    danger: { backgroundColor: colors.error, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
    primaryText: { color: colors.onAccent, fontWeight: '800', fontSize: 15 },
  });
