/**
 * Shared border-radius scale for TrivioQ mobile.
 * Use these tokens exclusively — no magic numbers in StyleSheet.
 */
export const radius = {
  /** 8 — small chips, badges, input corners */
  sm: 8,
  /** 12 — standard buttons, cards */
  md: 12,
  /** 16 — large cards, bottom sheets */
  lg: 16,
  /** 20 — modals, hero cards */
  xl: 20,
  /** 28 — avatar, FAB, pill buttons */
  pill: 28,
  /** 9999 — fully round */
  full: 9999,
} as const;
