'use client';

import { BRAND } from '@/lib/theme-tokens';

/**
 * PageBackground
 * Renders the full-page vivid gradient + ambient orbs that make glassmorphism visible.
 * Wrap any page with this (or use it in the layout) for consistent glass aesthetics.
 *
 * Monochrome teal atmosphere: three teal-tinted orbs (different shades/intensities)
 * use brand-scale tokens so a future "purple"/"indigo" accent theme only needs to
 * override `--brand-*` in `globals.css` to re-skin the entire atmosphere.
 */
const BRAND_ORBS = {
  deep: 'rgb(var(--brand-600) / 0.32)',
  mid: 'rgb(var(--brand-500) / 0.22)',
  light: 'rgb(var(--brand-300) / 0.18)',
};

export function PageBackground() {
  return (
    <>
      {/* ── Light-mode gradient canvas (teal halo → off-white) ── */}
      <div
        className="fixed inset-0 -z-20 dark:hidden pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${BRAND[50]} 0%, ${BRAND[50]} 60%, #ffffff 100%)`,
        }}
      />

      {/* ── Dark-mode gradient canvas (deep teal → slate) ── */}
      <div
        className="fixed inset-0 -z-20 hidden dark:block pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${BRAND[900]} 0%, rgb(var(--bg-primary)) 50%, rgb(var(--bg-secondary)) 100%)`,
        }}
      />

      {/* ── Teal orb — top-left (deep) ── */}
      <div className="fixed -top-40 -left-32 w-[650px] h-[650px] rounded-full pointer-events-none -z-10" style={{ background: `radial-gradient(circle at center, ${BRAND_ORBS.deep} 0%, transparent 65%)` }} />

      {/* ── Teal orb — top-right (mid) ── */}
      <div className="fixed -top-20 -right-20 w-[550px] h-[550px] rounded-full pointer-events-none -z-10" style={{ background: `radial-gradient(circle at center, ${BRAND_ORBS.mid} 0%, transparent 65%)` }} />

      {/* ── Teal orb — bottom-center (light) ── */}
      <div className="fixed bottom-0 left-1/3 w-[500px] h-[500px] rounded-full pointer-events-none -z-10" style={{ background: `radial-gradient(circle at center, ${BRAND_ORBS.light} 0%, transparent 65%)` }} />
    </>
  );
}
