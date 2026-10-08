import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme/radius';

/** Pulsing placeholder block shown while content loads. */
export function Skeleton({ width = '100%', height = 16, style, rounded = radius.sm }: { width?: number | `${number}%`; height?: number; style?: StyleProp<ViewStyle>; rounded?: number }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: rounded, backgroundColor: colors.borderColor, opacity }, style]} />;
}

/** A stack of card-shaped skeletons for list screens. */
export function SkeletonList({ count = 5, itemHeight = 72 }: { count?: number; itemHeight?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ padding: 16, gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={itemHeight} rounded={radius.md} />
      ))}
    </View>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Pill-style tab switcher. */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: 'row', backgroundColor: colors.bgSecondary, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderColor, padding: 3 }, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity key={o.value} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={o.label} onPress={() => onChange(o.value)} style={{ flex: 1, paddingVertical: 8, borderRadius: radius.full, alignItems: 'center', backgroundColor: active ? colors.brand : 'transparent' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.onAccent : colors.textSecondary }}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Small selectable chip used for filters. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: selected ? colors.brand : colors.borderColor, backgroundColor: selected ? colors.brandFaint : colors.bgSecondary, marginRight: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? colors.brand : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Compact metric card. */
export function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderColor, padding: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: accent ?? colors.textPrimary, marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}
