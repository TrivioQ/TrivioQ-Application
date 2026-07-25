// Mobile theme tokens.
//
// React Native StyleSheet can't read CSS custom properties without an extra
// library, so this TS module is the runtime source of truth for mobile colors.
// The TOKEN NAMES here are kept 1-for-1 with the web CSS variables defined in
// `apps/web/src/app/globals.css` so a future `packages/ui-tokens` can unify
// both stacks.
//
// To "reskin" the mobile app, override one of these light/dark entries.
// `withAlpha()` (theme/tokens.ts) composes brand-with-alpha literals for any
// case where an alpha variant wasn't pre-materialized.

export interface ThemeColors {
  // Semantic neutrals (slate scale, light/dark invariant name → different RGB)
  bgPrimary: string;
  bgSecondary: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  overlay: string;

  // Brand scale (teal default)
  brand: string; // brand-500
  brandFaint: string; // brand-500 @ ~10%
  brandSoft: string; // brand-500 @ ~25%
  brandStrong: string; // brand-700

  // Status
  success: string;
  successFaint: string; // alpha-hex for borders/hairlines
  warning: string;
  warningFaint: string;
  error: string;
  errorFaint: string;
  info: string;

  // Premium accent (royal purple) — used by profile/subscription screens
  premium: string;
  premiumFaint: string;

  // Liquid/yellow gold accent — used by subscription hero
  goldAccent: string;
  goldAccentFaint: string;
  goldDeep: string; // #CA8A04 — premium column text, dark mode safe glyph
  goldDeepFaint: string;

  // Purple accent — "Premium" feature column header on subscription table
  purpleAccent: string; // #7c3aed — stronger than `premium` (lavender chip)
  purpleAccentFaint: string;

  // Podium medal colors — leaderboard #1/#2/#3 chips.
  // Theme-invariant: silver/bronze/gold read the same in light and dark.
  medalGold: string; // #fbbf24
  medalSilver: string; // #94a3b8
  medalBronze: string; // #f97316

  // Glass surfaces (white / dark tinted at low alpha)
  glassBg: string;
  glassBorder: string;

  // Overlays / scrims
  scrim: string; // rgba(0,0,0,0.5) — modal backdrop
  scrimStrong: string; // rgba(0,0,0,0.85) — full-screen dim

  // Text color that sits ON TOP of the brand accent / status colors.
  // Stays white in both modes by design — these chips/buttons get their
  // identity from the saturated bg, not from the surrounding theme.
  onAccent: string;
  onDark: string; // light text over dark backdrop (header, modal title bar)
  onLight: string; // dark text over light backdrop
}

export const lightColors: ThemeColors = {
  bgPrimary: '#F8FAFC',
  bgSecondary: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  borderColor: '#E2E8F0',
  overlay: '#020617',

  brand: '#14B8A6', // teal-500
  brandFaint: '#14B8A61A',
  brandSoft: '#14B8A640',
  brandStrong: '#0F766E', // teal-700

  success: '#22c55e',
  successFaint: '#22c55e33',
  warning: '#f59e0b',
  warningFaint: '#f59e0b33',
  error: '#ef4444',
  errorFaint: '#ef444433',
  info: '#3b82f6',

  premium: '#a78bfa',
  premiumFaint: '#a78bfa26',
  goldAccent: '#fde047',
  goldAccentFaint: '#fde04726',
  goldDeep: '#CA8A04',
  goldDeepFaint: '#CA8A0426',
  purpleAccent: '#7c3aed',
  purpleAccentFaint: '#7c3aed26',

  medalGold: '#fbbf24',
  medalSilver: '#94a3b8',
  medalBronze: '#f97316',

  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.5)',

  scrim: 'rgba(0, 0, 0, 0.5)',
  scrimStrong: 'rgba(0, 0, 0, 0.85)',

  onAccent: '#FFFFFF',
  onDark: '#F8FAFC',
  onLight: '#0F172A',
};

export const darkColors: ThemeColors = {
  bgPrimary: '#020617',
  bgSecondary: '#0F172A',
  surfaceElevated: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  borderColor: '#1E293B',
  overlay: '#020617',

  brand: '#14B8A6',
  brandFaint: '#14B8A633',
  brandSoft: '#14B8A64D',
  brandStrong: '#0F766E',

  success: '#22c55e',
  successFaint: '#22c55e4D',
  warning: '#f59e0b',
  warningFaint: '#f59e0b4D',
  error: '#ef4444',
  errorFaint: '#ef44444D',
  info: '#3b82f6',

  premium: '#a78bfa',
  premiumFaint: '#a78bfa33',
  goldAccent: '#fde047',
  goldAccentFaint: '#fde04733',
  goldDeep: '#CA8A04',
  goldDeepFaint: '#CA8A0433',
  purpleAccent: '#7c3aed',
  purpleAccentFaint: '#7c3aed33',

  medalGold: '#fbbf24',
  medalSilver: '#94a3b8',
  medalBronze: '#f97316',

  glassBg: 'rgba(15, 23, 42, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',

  scrim: 'rgba(0, 0, 0, 0.65)',
  scrimStrong: 'rgba(0, 0, 0, 0.85)',

  onAccent: '#FFFFFF',
  onDark: '#F8FAFC',
  onLight: '#F8FAFC',
};
