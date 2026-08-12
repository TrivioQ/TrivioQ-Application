import type { AIProvider, AIModel, AIProviderProtocol } from '@trivioq/database';

/**
 * A fully-resolved, ready-to-call AI provider connection.
 *
 * Built by {@link ../registry.ts} from an AIModel + its AIProvider row, with the
 * API key decrypted and the protocol picked from the provider row. The adapter
 * layer consumes only this shape — never the raw DB rows — so the registry
 * stays the single place that touches Prisma and the crypto module.
 */
export interface ProviderConnection {
  protocol: AIProviderProtocol;
  /** Display name used in worker logs (preserves the old `[GoogleProvider]` prefix). */
  displayName: string;
  baseUrl: string | null;
  /** Decrypted API key. Empty string when the provider uses optional/no auth. */
  apiKey: string;
  defaultHeaders: Record<string, string> | null;
  /** Provider-account-level pacing floor in ms (replaces the old enforceRateLimit). */
  minCallIntervalMs: number;
  /** Model fields. */
  modelName: string;
  maxOutputTokens: number | null;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  extraParams: Record<string, unknown> | null;
}

export type ResolvedProvider = {
  model: Pick<AIModel, 'id' | 'modelName' | 'displayName' | 'supportsVision' | 'supportsJsonMode'>;
  provider: Pick<AIProvider, 'id' | 'name' | 'displayName' | 'protocol' | 'baseUrl' | 'minCallIntervalMs' | 'isActive'>;
};
