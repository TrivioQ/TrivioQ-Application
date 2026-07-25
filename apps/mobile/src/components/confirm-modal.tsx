import React, { createContext, useContext, useRef, useState, useCallback, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: '', message: '' });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = (confirmed: boolean) => {
    setOpen(false);
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => handleClose(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={[styles.accent, options.isDestructive ? styles.accentDestructive : styles.accentDefault]} />
            <Text style={styles.title}>{options.title}</Text>
            <Text style={styles.message}>{options.message}</Text>
            <View style={styles.actions}>
              {options.cancelLabel !== '' && (
                <TouchableOpacity style={styles.cancelButton} onPress={() => handleClose(false)} activeOpacity={0.75}>
                  <Text style={styles.cancelText}>{options.cancelLabel ?? t('common.cancel')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.confirmButton, options.isDestructive ? styles.confirmDestructive : styles.confirmDefault]} onPress={() => handleClose(true)} activeOpacity={0.8}>
                <Text style={styles.confirmText}>{options.confirmLabel ?? t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      backgroundColor: colors.bgSecondary,
      borderRadius: 20,
      padding: 24,
      overflow: 'hidden',
      shadowColor: colors.overlay,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    accent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
    },
    accentDefault: { backgroundColor: colors.brand },
    accentDestructive: { backgroundColor: colors.error },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 10,
      marginTop: 8,
    },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 24,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    cancelButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    cancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    confirmButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    confirmDefault: { backgroundColor: colors.brand },
    confirmDestructive: { backgroundColor: colors.error },
    confirmText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onAccent,
    },
  });
