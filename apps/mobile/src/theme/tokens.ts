/**
 * Theme helper tokens for TrivioQ mobile.
 *
 * `withAlpha` composes an RGBA string from a `#RRGGBB` hex plus an alpha
 * value (0..1). Use this when a literal color must take an alpha tween that
 * isn't pre-materialized in `colors.ts`. Otherwise prefer the named
 * `*Faint` / `*Soft` entries on `ThemeColors` so the token vocabulary
 * stays a closed set.
 *
 * Example:
 *   withAlpha(colors.brand, 0.2)   // → "rgba(20,184,166,0.2)"
 */
export const withAlpha = (hex: string, alpha: number): string => {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * 8-character alpha-hex: `'#RRGGBBAA'`. Used by RN borderColor/backgroundColor
 * when a low-alpha tween needs to be a literal (StyleSheet reads no Tailwind
 * token layer). Composition helper for screens that need to keep this form.
 *
 *   withAlphaHex(colors.brand, 0.2)  // → "#14B8A633"
 */
export const withAlphaHex = (hex: string, alpha: number): string => {
  const v = hex.replace('#', '');
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${v.toUpperCase()}${a}`;
};
