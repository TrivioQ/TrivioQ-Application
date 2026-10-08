import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Modal, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme/radius';

const CONFETTI = ['🎉', '✨', '🔥', '⭐', '🎊', '🏆'];
const PIECES = 18;

/** Full-screen celebration shown when a streak milestone is reached. */
export function MilestoneModal({ streak, visible, onClose }: { streak: number | null; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.6)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');

  // Random positions are fixed per mount so pieces don't jump on re-render.
  const pieces = useMemo(() => Array.from({ length: PIECES }).map((_, i) => ({ emoji: CONFETTI[i % CONFETTI.length], x: Math.random() * width, delay: Math.random() * 0.4, size: 18 + Math.random() * 14 })), [width]);

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AccessibilityInfo.announceForAccessibility(t('milestone.title', { count: streak ?? 0 }));
    scale.setValue(0.6);
    fall.setValue(0);
    Animated.parallel([Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }), Animated.timing(fall, { toValue: 1, duration: 2200, easing: Easing.in(Easing.quad), useNativeDriver: true })]).start();
  }, [visible, streak, scale, fall, t]);

  if (!streak) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrimStrong, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {pieces.map((p, i) => (
          <Animated.Text
            key={i}
            importantForAccessibility="no"
            style={{
              position: 'absolute',
              top: -40,
              left: p.x,
              fontSize: p.size,
              transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, height + 80] }) }, { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 360}deg`] }) }],
              opacity: fall.interpolate({ inputRange: [0, p.delay, 1], outputRange: [0, 1, 0.6] }),
            }}
          >
            {p.emoji}
          </Animated.Text>
        ))}
        <Animated.View style={{ transform: [{ scale }], backgroundColor: colors.bgSecondary, borderRadius: radius.xl, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360 }}>
          <Text style={{ fontSize: 64 }}>🔥</Text>
          <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '900', color: colors.textPrimary, marginTop: 8, textAlign: 'center' }}>
            {t('milestone.title', { count: streak })}
          </Text>
          <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>{t('milestone.body')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={{ marginTop: 22, backgroundColor: colors.brand, paddingVertical: 12, paddingHorizontal: 32, borderRadius: radius.md }}>
            <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 16 }}>{t('milestone.cta')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
