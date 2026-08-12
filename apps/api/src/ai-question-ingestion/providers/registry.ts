import { prisma, decrypt, type AIModel } from '@trivioq/database';
import { GenericAIProvider } from './generic-provider';
import type { AIProvider, AIProviderProtocol } from '@trivioq/database';
import type { ProviderConnection } from './adapters/connection';
import type { AIProvider as IAIProvider } from './ai-provider';

/**
 * Provider registry — the single place that touches Prisma and the crypto
 * module to build a ready-to-call AIProvider instance.
 *
 * Replaces the old createProvider() switch + the 5 concrete provider classes.
 * A new OpenAI-compatible vendor now means one admin-portal row, not a code
 * change: pick protocol `openai`, set baseUrl + key, add a model, and it flows
 * through GenericAIProvider → callOpenAI automatically.
 *
 * The constructed GenericAIProvider instance is cached by modelId for 60s
 * (mirrors utils/settings.ts). Caching the *instance* — not just the connection
 * — is deliberate: it preserves the provider's lastCallTime pacing state across
 * calls within a phase, the way the old per-provider class instance did.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { provider: GenericAIProvider; expiresAt: number }>();

/** Invalidate a modelId's cached instance so the next resolveProvider hits the DB. */
export function invalidateProviderCache(modelId: string): void {
  cache.delete(modelId);
}

/** Clear the whole registry cache (used by the test-connection endpoint + tests). */
export function clearProviderCache(): void {
  cache.clear();
}

function toConnection(model: AIModel & { provider: AIProvider }): ProviderConnection {
  const provider = model.provider;
  let apiKey = '';
  if (provider.apiKeyCipher) {
    try {
      apiKey = decrypt(provider.apiKeyCipher);
    } catch (e) {
      throw new Error(
        `[provider-registry] Failed to decrypt API key for provider "${provider.displayName}" ` +
          `(id=${provider.id}): ${e instanceof Error ? e.message : e}. ` +
          'Check ENCRYPTION_MASTER_KEY and re-enter the key in the admin portal.',
      );
    }
  }

  return {
    protocol: provider.protocol,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    apiKey,
    defaultHeaders: (provider.defaultHeaders as Record<string, string> | null) ?? null,
    minCallIntervalMs: provider.minCallIntervalMs,
    modelName: model.modelName,
    maxOutputTokens: model.maxOutputTokens,
    supportsVision: model.supportsVision,
    supportsJsonMode: model.supportsJsonMode,
    extraParams: (model.extraParams as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Resolve a ready-to-call provider for a modelId.
 *
 * Throws if the model/provider is inactive, the key cannot be decrypted, or the
 * protocol has no implemented adapter (e.g. anthropic).
 */
export async function resolveProvider(modelId: string, _signal?: AbortSignal): Promise<IAIProvider> {
  const hit = cache.get(modelId);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.provider;
  }

  const model = await prisma.aIModel.findUnique({
    where: { id: modelId, isActive: true },
    include: { provider: true },
  });

  if (!model) {
    throw new Error(`[provider-registry] No active AIModel found for id=${modelId}.`);
  }
  if (!model.isActive) {
    throw new Error(`[provider-registry] AIModel "${model.displayName}" (id=${modelId}) is inactive.`);
  }
  if (!model.provider.isActive) {
    throw new Error(
      `[provider-registry] Provider "${model.provider.displayName}" for model "${model.displayName}" is inactive.`,
    );
  }
  const protocol: AIProviderProtocol = model.provider.protocol;
  if (protocol === 'anthropic') {
    throw new Error(`[provider-registry] Anthropic adapter is not implemented (provider "${model.provider.displayName}").`);
  }

  const connection = toConnection(model as AIModel & { provider: AIProvider });
  const provider = new GenericAIProvider(connection);
  cache.set(modelId, { provider, expiresAt: Date.now() + CACHE_TTL_MS });
  return provider;
}
