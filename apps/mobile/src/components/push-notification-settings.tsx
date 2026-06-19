import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationPermissionStatus,
} from '../lib/push-notification-service';

export function PushNotificationSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    const status = await getNotificationPermissionStatus();
    setIsSupported(status.isSupported);
    setPermissionStatus(status.status);
    setIsSubscribed(status.isGranted);
    setLoading(false);
  }

  async function handleSubscribe() {
    setLoading(true);
    const success = await subscribeToPushNotifications();
    if (success) {
      setIsSubscribed(true);
      setPermissionStatus('granted');
      Alert.alert(
        t('notifications.pushEnabled'),
        t('notifications.pushEnabledSub')
      );
    } else {
      Alert.alert(
        t('notifications.pushEnableFailed'),
        t('notifications.pushEnableFailedSub')
      );
    }
    setLoading(false);
  }

  async function handleUnsubscribe() {
    setLoading(true);
    const success = await unsubscribeFromPushNotifications();
    if (success) {
      setIsSubscribed(false);
      Alert.alert(
        t('notifications.pushDisabled'),
        t('notifications.pushDisabledSub')
      );
    }
    setLoading(false);
  }

  if (!isSupported) {
    return (
      <View style={[styles.container, styles.notSupported]}>
        <Ionicons name="notifications-off-outline" size={24} color={colors.textSecondary} />
        <Text style={[styles.text, styles.notSupportedText]}>
          {t('notifications.notSupported')}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.brand} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {t('notifications.loading')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isSubscribed && styles.subscribedContainer]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={isSubscribed ? 'notifications' : 'notifications-outline'}
          size={24}
          color={isSubscribed ? colors.brand : colors.textSecondary}
        />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {isSubscribed ? t('notifications.pushEnabled') : t('notifications.enablePush')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isSubscribed
            ? t('notifications.pushEnabledDesc')
            : t('notifications.pushEnableDesc')}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          isSubscribed ? styles.buttonSecondary : styles.buttonPrimary,
        ]}
        onPress={isSubscribed ? handleUnsubscribe : handleSubscribe}
        disabled={loading || permissionStatus === 'denied'}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isSubscribed ? colors.brand : '#fff'} />
        ) : (
          <Text
            style={[
              styles.buttonText,
              isSubscribed
                ? { color: colors.brand }
                : { color: '#fff' },
            ]}
          >
            {isSubscribed ? t('common.disable') : t('common.enable')}
          </Text>
        )}
      </TouchableOpacity>

      {permissionStatus === 'denied' && (
        <View style={styles.deniedBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={[styles.deniedText, { color: colors.error }]}>
            {t('notifications.permissionDenied')}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    subscribedContainer: {
      backgroundColor: colors.brand + '10',
      borderColor: colors.brand,
    },
    notSupported: {
      opacity: 0.7,
    },
    notSupportedText: {
      marginLeft: 8,
      fontSize: 13,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
    },
    subtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      minWidth: 80,
      alignItems: 'center',
    },
    buttonPrimary: {
      backgroundColor: colors.brand,
    },
    buttonSecondary: {
      backgroundColor: colors.bgPrimary,
      borderWidth: 1,
      borderColor: colors.brand,
    },
    buttonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    deniedBanner: {
      position: 'absolute',
      bottom: -30,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    deniedText: {
      fontSize: 11,
    },
    text: {
      fontSize: 13,
      marginLeft: 8,
    },
  });