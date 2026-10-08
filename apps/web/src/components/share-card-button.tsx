'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Share2 } from 'lucide-react';

export interface ShareCardData {
  streak: number;
  totalScore: number;
  pointsAwarded: number;
  category: string;
  isCorrect: boolean;
}

/**
 * Shares an image result card (rendered by /api/share-card) through the Web
 * Share API. Browsers without file sharing get the image in a new tab and the
 * brag text on the clipboard.
 */
export function ShareCardButton({ data, className }: { data: ShareCardData; className?: string }) {
  const t = useTranslations('share');
  const [busy, setBusy] = useState(false);

  const text = t('message', { streak: data.streak });
  const params = new URLSearchParams({
    category: data.category,
    emoji: data.isCorrect ? 'target' : 'brain',
    l1: t('streakLine', { count: data.streak }),
    l2: t('scoreLine', { score: data.totalScore.toLocaleString() }),
    cta: t('cta'),
    ...(data.pointsAwarded > 0 ? { l3: t('pointsLine', { count: data.pointsAwarded }) } : {}),
  });
  const imageUrl = `/api/share-card?${params}`;

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], 'trivioq-result.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        window.open(imageUrl, '_blank', 'noopener');
        await navigator.clipboard?.writeText(text).catch(() => undefined);
        toast.success(t('copied'));
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={handleShare} disabled={busy} className={className ?? 'inline-flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 disabled:opacity-50 px-4 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-300 transition-colors'}>
      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
      {busy ? t('preparing') : t('button')}
    </button>
  );
}
