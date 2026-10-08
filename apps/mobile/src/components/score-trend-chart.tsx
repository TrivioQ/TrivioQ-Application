import React, { useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import type { ScorePeriod } from '../api/queries';

const CHART_HEIGHT = 160;
const AXIS_GUTTER = 18;
const MAX_BARS = 8;

function formatLabel(iso: string, mode: 'weekly' | 'monthly', locale: string) {
  const d = new Date(iso);
  return mode === 'monthly' ? d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }) : d.toLocaleDateString(locale, { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Stacked bar chart of base + bonus points per period (mobile counterpart of the
 * web Recharts ScoreTrendChart). Drawn with react-native-svg — no chart library.
 */
export function ScoreTrendChart({ data, mode }: { data: ScorePeriod[]; mode: 'weekly' | 'monthly' }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const sorted = [...data].sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()).slice(-MAX_BARS);

  if (sorted.length === 0) {
    return (
      <View style={{ height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('home.chartNoData')}</Text>
      </View>
    );
  }

  const max = Math.max(1, ...sorted.map((p) => p.baseScore + p.bonusScore));
  const plotHeight = CHART_HEIGHT - AXIS_GUTTER;
  const slot = width / sorted.length;
  const barWidth = Math.min(28, slot * 0.6);
  const summary = sorted.map((p) => `${formatLabel(p.periodStart, mode, i18n.language)}: ${p.totalScore}`).join(', ');

  return (
    <View>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={`${t(mode === 'weekly' ? 'home.weeklyTrend' : 'home.monthlyTrend')}. ${summary}`} style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Line x1={0} x2={width} y1={plotHeight} y2={plotHeight} stroke={colors.borderColor} strokeWidth={1} />
            {sorted.map((p, i) => {
              const x = i * slot + (slot - barWidth) / 2;
              const baseH = (p.baseScore / max) * (plotHeight - 4);
              const bonusH = (p.bonusScore / max) * (plotHeight - 4);
              return (
                <React.Fragment key={p.id}>
                  <Rect x={x} y={plotHeight - baseH} width={barWidth} height={baseH} rx={3} fill={colors.brand} />
                  {bonusH > 0 && <Rect x={x} y={plotHeight - baseH - bonusH} width={barWidth} height={bonusH} rx={3} fill={colors.goldAccent} />}
                  <SvgText x={x + barWidth / 2} y={CHART_HEIGHT - 4} fontSize={9} fill={colors.textSecondary} textAnchor="middle">
                    {formatLabel(p.periodStart, mode, i18n.language)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
        <Legend color={colors.brand} label={t('home.chartBase')} />
        <Legend color={colors.goldAccent} label={t('home.chartBonus')} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}
