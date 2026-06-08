'use client';

/**
 * PageBackground
 * Renders the full-page vivid gradient + ambient orbs that make glassmorphism visible.
 * Wrap any page with this (or use it in the layout) for consistent glass aesthetics.
 */
export function PageBackground() {
  return (
    <>
      {/* ── Light-mode gradient canvas ── */}
      <div
        className="fixed inset-0 -z-20 dark:hidden pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #e0e7ff 0%, #f0f9ff 30%, #fdf2f8 60%, #fff7ed 100%)',
        }}
      />

      {/* ── Dark-mode gradient canvas ── */}
      <div
        className="fixed inset-0 -z-20 hidden dark:block pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #0f0c29 0%, #030524 40%, #0a0a2e 100%)',
        }}
      />

      {/* ── Indigo orb — top-left ── */}
      <div
        className="fixed -top-40 -left-32 w-[650px] h-[650px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle at center, rgba(99,102,241,0.35) 0%, transparent 65%)',
        }}
      />

      {/* ── Orange orb — top-right ── */}
      <div
        className="fixed -top-20 -right-20 w-[550px] h-[550px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle at center, rgba(251,146,60,0.25) 0%, transparent 65%)',
        }}
      />

      {/* ── Purple orb — bottom-center ── */}
      <div
        className="fixed bottom-0 left-1/3 w-[500px] h-[500px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle at center, rgba(168,85,247,0.22) 0%, transparent 65%)',
        }}
      />
    </>
  );
}
