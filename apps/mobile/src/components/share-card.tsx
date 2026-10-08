import React, { useRef, useState } from 'react';
import { ActivityIndicator, Share, Text, TouchableOpacity, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme/radius';

export interface ShareCardData {
  streak: number;
  totalScore: number;
  pointsAwarded: number;
  category: string;
  isCorrect: boolean;
}

/**
 * Renders a branded result card off-screen, captures it as a PNG and opens the
 * native share sheet. Falls back to a text share if image sharing is unavailable.
 */
export function ShareCardButton({ data, style, textStyle }: { data: ShareCardData; style?: any; textStyle?: any }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const textMessage = t('drop.shareMessage', { streak: data.streak });

  const handleShare = async () => {
    setBusy(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: textMessage, UTI: 'public.png' });
      } else {
        await Share.share({ message: textMessage });
      }
    } catch (error: any) {
      console.error('Share failed:', error);
      toast.error(t('drop.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Off-screen card; collapsable={false} keeps the native view so it can be captured. */}
      <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View ref={cardRef} collapsable={false} style={{ width: 360, padding: 28, borderRadius: 24, backgroundColor: '#0F172A' }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: '#FFFFFF' }}>
            Trivio<Text style={{ color: colors.brand }}>Q</Text>
          </Text>
          <Text style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>{data.category}</Text>
          <Text style={{ fontSize: 56, marginTop: 18 }}>{data.isCorrect ? '🎯' : '🧠'}</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 8 }}>{t('share.streakLine', { count: data.streak })}</Text>
          <Text style={{ fontSize: 16, color: '#CBD5E1', marginTop: 6 }}>{t('share.scoreLine', { score: data.totalScore.toLocaleString() })}</Text>
          {data.pointsAwarded > 0 && <Text style={{ fontSize: 16, fontWeight: '700', color: '#34D399', marginTop: 4 }}>{t('share.pointsLine', { count: data.pointsAwarded })}</Text>}
          <View style={{ marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1E293B' }}>
            <Text style={{ fontSize: 13, color: '#94A3B8' }}>{t('share.cta')}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('drop.shareButton')} style={[{ borderRadius: radius.md }, style]} onPress={handleShare} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.brand} /> : <Text style={textStyle}>{t('drop.shareButton')}</Text>}
      </TouchableOpacity>
    </>
  );
}
