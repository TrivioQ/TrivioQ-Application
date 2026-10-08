'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

const CONFETTI = ['🎉', '✨', '🔥', '⭐', '🎊', '🏆'];

/** Celebration dialog shown when a streak milestone is reached. */
export function MilestoneModal({ streak, onClose }: { streak: number | null; onClose: () => void }) {
  const t = useTranslations('milestone');
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const pieces = useMemo(() => Array.from({ length: 18 }).map((_, i) => ({ emoji: CONFETTI[i % CONFETTI.length], left: Math.random() * 100, delay: Math.random() * 0.4, size: 18 + Math.random() * 14 })), [streak]);

  useEffect(() => {
    if (!streak) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [streak, onClose]);

  return (
    <AnimatePresence>
      {streak && (
        <motion.div role="dialog" aria-modal="true" aria-labelledby="milestone-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/70 backdrop-blur-sm p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          {!reduceMotion &&
            pieces.map((p, i) => (
              <motion.span key={i} aria-hidden="true" className="pointer-events-none absolute top-0" style={{ left: `${p.left}%`, fontSize: p.size }} initial={{ y: -40, rotate: 0, opacity: 0 }} animate={{ y: '105vh', rotate: i % 2 ? 360 : -360, opacity: [0, 1, 1, 0.6] }} transition={{ duration: 2.2, delay: p.delay, ease: 'easeIn' }}>
                {p.emoji}
              </motion.span>
            ))}
          <motion.div className="relative w-full max-w-sm rounded-3xl bg-bg-secondary border border-brand-100 dark:border-white/10 p-8 text-center shadow-2xl" initial={{ scale: reduceMotion ? 1 : 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }} onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl" aria-hidden="true">
              🔥
            </div>
            <h2 id="milestone-title" className="mt-3 text-2xl font-extrabold text-text">
              {t('title', { count: streak })}
            </h2>
            <p className="mt-2 text-sm text-text-muted">{t('body')}</p>
            <button ref={closeRef} onClick={onClose} className="mt-6 rounded-xl bg-brand-600 hover:bg-brand-500 px-8 py-2.5 text-sm font-bold text-white transition-colors">
              {t('cta')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
