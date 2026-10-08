import React from 'react';
import { Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

/** Thin banner shown while the device is offline; cached data stays visible. */
export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();

  // `null` means "unknown yet" — don't flash the banner on launch.
  if (isConnected !== false) return null;

  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 4, paddingBottom: 6, backgroundColor: colors.warning, alignItems: 'center', zIndex: 100 }}>
      <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 12 }}>{t('common.offline')}</Text>
    </View>
  );
}
