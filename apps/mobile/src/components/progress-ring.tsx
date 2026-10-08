import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

/** Circular progress indicator with a centered label. */
export function ProgressRing({ value, max, size = 92, stroke = 9, label, sublabel }: { value: number; max: number; size?: number; stroke?: number; label: string; sublabel?: string }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = max > 0 ? Math.min(1, value / max) : 0;

  return (
    <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: Math.min(value, max) }} accessibilityLabel={sublabel ? `${label} ${sublabel}` : label} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.borderColor} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={fraction >= 1 ? colors.success : colors.brand} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - fraction)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{label}</Text>
      {sublabel ? <Text style={{ fontSize: 10, color: colors.textSecondary }}>{sublabel}</Text> : null}
    </View>
  );
}
