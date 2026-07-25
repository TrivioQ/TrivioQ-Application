/**
 * Theme tokens — JS mirror of `apps/web/src/app/globals.css` `--brand-*`
 * and status CSS variables. Exists for the rare cases where Tailwind
 * utilities cannot reach (Recharts SVG `fill`/`stroke`, dynamic JS-driven
 * canvas, inline `style={{ boxShadow }}`).
 *
 * IMPORTANT: keep in lock-step with `globals.css`. The values here
 * are the LIGHT-mode defaults; for theme-aware runtime access use a
 * `useThemeCss()` consumer that re-reads vars off `document.documentElement`.
 */
export const BRAND = {
  50: '#F0FDFA',
  100: '#CCFBF1',
  300: '#5EEAD4',
  400: '#2DD4BF',
  500: '#14B8A6',
  600: '#0D9488',
  700: '#0F766E',
  800: '#115E59',
  900: '#134E4A',
} as const;

export const STATUS = {
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

/** Neutral axis / grid color (static — always gray-500, no theme switch). */
export const AXIS = '#6B7280';

/** Compose a CSS `rgba()` string from a token RGB triplet + alpha.
 *  For graphs/strokes where the value must be a literal string. */
export const withAlpha = (hex: string, alpha: number): string => {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Compose a CSS-var-backed RGB string. Browsers replace `var(--x)` inside
 *  SVG `stroke`/`fill` attributes at paint time, so chart axes/dividers
 *  can follow the active theme. */
export const rgbaVar = (cssVar: `--${string}`, alpha: number): string => `rgb(var(${cssVar}) / ${alpha})`;
