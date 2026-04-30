import { prisma } from '@trivioq/database';

const CACHE_TTL_MS = 60_000; // re-fetch from DB at most once per minute

const cache = new Map<string, { value: string; expiresAt: number }>();

export async function getSetting(key: string, fallback: string): Promise<string> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    const value = row?.value ?? fallback;
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch {
    return fallback;
  }
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const raw = await getSetting(key, String(fallback));
  const parsed = Number(raw);
  return isNaN(parsed) ? fallback : parsed;
}
