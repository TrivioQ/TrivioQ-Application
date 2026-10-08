// Pure helpers shared by the web and mobile clients. No platform imports here.

// ── Category bundles ─────────────────────────────────────────────────────────

export interface CategoryBundle {
  id: 'science' | 'popCulture' | 'historyGeo' | 'sports' | 'lifestyle';
  emoji: string;
  /** Lower-case fragments matched against a category's name and slug. */
  keywords: string[];
}

export const CATEGORY_BUNDLES: CategoryBundle[] = [
  { id: 'science', emoji: '🔬', keywords: ['science', 'physics', 'chemistry', 'biology', 'space', 'astronomy', 'math', 'technology', 'computer', 'tech', 'nature', 'animal', 'medicine', 'health', 'environment', 'invention'] },
  { id: 'popCulture', emoji: '🎬', keywords: ['movie', 'film', 'cinema', 'music', 'tv', 'television', 'celebrit', 'pop', 'video game', 'gaming', 'comic', 'anime', 'entertainment', 'bollywood', 'hollywood', 'book', 'literature'] },
  { id: 'historyGeo', emoji: '🌍', keywords: ['history', 'geography', 'world', 'culture', 'art', 'mythology', 'politic', 'religion', 'language', 'capital', 'countr', 'civilization', 'war', 'heritage'] },
  { id: 'sports', emoji: '🏏', keywords: ['sport', 'cricket', 'football', 'soccer', 'tennis', 'olympic', 'basketball', 'athlet', 'chess', 'racing'] },
  { id: 'lifestyle', emoji: '🍳', keywords: ['food', 'cuisine', 'cooking', 'travel', 'fashion', 'business', 'economy', 'brand', 'general'] },
];

export interface CategoryLike {
  name: string;
  slug: string;
}

/** Category names that belong to a bundle (matched on name or slug). */
export function categoriesInBundle<T extends CategoryLike>(bundle: CategoryBundle, categories: T[]): string[] {
  return categories
    .filter((c) => {
      const haystack = `${c.name} ${c.slug.replace(/-/g, ' ')}`.toLowerCase();
      return bundle.keywords.some((k) => haystack.includes(k));
    })
    .map((c) => c.name);
}

/**
 * "Pick for me": a balanced selection of `count` categories, round-robin across
 * bundles so no single topic dominates, then topped up from the remainder.
 * `seed` makes the shuffle reproducible (defaults to random).
 */
export function pickBalancedCategories<T extends CategoryLike>(categories: T[], count: number, seed: number = Math.random()): string[] {
  let state = Math.floor(seed * 2 ** 31) || 1;
  const rand = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  const shuffle = <U>(arr: U[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pools = CATEGORY_BUNDLES.map((b) => shuffle(categoriesInBundle(b, categories)));
  const picked = new Set<string>();
  const target = Math.min(count, categories.length);

  while (picked.size < target && pools.some((p) => p.length > 0)) {
    for (const pool of pools) {
      const next = pool.shift();
      if (next) picked.add(next);
      if (picked.size >= target) break;
    }
  }
  for (const name of shuffle(categories.map((c) => c.name))) {
    if (picked.size >= target) break;
    picked.add(name);
  }
  return Array.from(picked);
}

export const MIN_CATEGORIES = 30;

// ── Active window time zone conversion ───────────────────────────────────────
// The API stores the active window as a UTC time-of-day ("HH:MM"). Clients show
// and edit it in the device's local time zone and convert at the boundary.

const pad = (n: number) => String(n).padStart(2, '0');

function shiftHHMM(hhmm: string, deltaMinutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + deltaMinutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Local "HH:MM" → UTC "HH:MM" using today's offset (handles DST for today). */
export function localHHMMToUtc(hhmm: string, now: Date = new Date()): string {
  return shiftHHMM(hhmm, now.getTimezoneOffset());
}

/** UTC "HH:MM" → local "HH:MM". */
export function utcHHMMToLocal(hhmm: string, now: Date = new Date()): string {
  return shiftHHMM(hhmm, -now.getTimezoneOffset());
}

/** ISO DateTime from the API's window columns → local "HH:MM". */
export function windowIsoToLocalHHMM(iso: string | null | undefined, fallback: string, now: Date = new Date()): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return utcHHMMToLocal(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, now);
}

// ── Streak milestones ────────────────────────────────────────────────────────

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

/** The milestone just reached by `newStreak`, if any. */
export function reachedStreakMilestone(newStreak: number): number | null {
  return STREAK_MILESTONES.includes(newStreak) ? newStreak : null;
}

// ── Invite links ─────────────────────────────────────────────────────────────

/** The web signup link carrying the user's referral code (their user id). */
export function buildInviteLink(webUrl: string, userId: string): string {
  return `${webUrl.replace(/\/+$/, '')}/signup?referral=${encodeURIComponent(userId)}`;
}
