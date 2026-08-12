/**
 * Seeds the AIProvider / AIModel / IngestionStageConfig tables so the system
 * reproduces today's exact runtime the moment the migration lands — no code
 * deploy needed, no admin clicks required.
 *
 * Reads current env-var API keys (GEMINI_API_KEY, NVIDIA_API_KEY, etc.),
 * encrypts them with crypto.encrypt (requires ENCRYPTION_MASTER_KEY), and
 * upserts every row idempotently.
 *
 * Run after the add_ai_provider_model_stageconfig migration:
 *   pnpm --filter @trivioq/database seed:ai-providers
 */
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/crypto';

const prisma = new PrismaClient();

function encryptedKey(envVar: string): string | null {
  const key = process.env[envVar];
  if (!key) return null;
  return encrypt(key);
}

// ── Provider definitions (reproduces today's 5 hard-coded providers) ──────────
// minCallIntervalMs mirrors the old enforceRateLimit() calls:
//   google=4000, deepseek=1500, others=0
const PROVIDERS = [
  {
    name: 'google',
    displayName: 'Google Gemini',
    description: 'Google Gemini models via the native @google/genai SDK.',
    protocol: 'gemini' as const,
    baseUrl: null,
    apiKeyCipher: encryptedKey('GEMINI_API_KEY'),
    minCallIntervalMs: 4000,
  },
  {
    name: 'nvidia',
    displayName: 'NVIDIA NIM',
    description: 'NVIDIA NIM / integrate.api.nvidia.com endpoint (OpenAI-compatible).',
    protocol: 'openai' as const,
    baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    apiKeyCipher: encryptedKey('NVIDIA_API_KEY'),
    minCallIntervalMs: 0,
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    description: 'DeepSeek chat completions (OpenAI-compatible).',
    protocol: 'openai' as const,
    baseUrl: 'https://api.deepseek.com/chat/completions',
    apiKeyCipher: encryptedKey('DEEPSEEK_API_KEY'),
    minCallIntervalMs: 1500,
  },
  {
    name: 'omnirouter',
    displayName: 'OmniRouter',
    description: 'OmniRouter local proxy. Auth optional (no key required).',
    protocol: 'openai' as const,
    baseUrl: process.env.OMNIROUTER_API_URL ?? 'http://localhost:20128/v1/chat/completions',
    apiKeyCipher: encryptedKey('OMNIROUTER_API_KEY'),
    minCallIntervalMs: 0,
  },
  {
    name: 'local',
    displayName: 'Local VLM',
    description: 'Local vision-language model via multipart form upload.',
    protocol: 'local_form' as const,
    baseUrl: process.env.LOCAL_LLM_URL ?? 'http://localhost:3713/v1/analyze-page',
    apiKeyCipher: null,
    minCallIntervalMs: 0,
  },
];

// ── Model definitions ─────────────────────────────────────────────────────────
// modelName is the literal string sent in the request payload, matching the
// old FALLBACK_MODEL / seed-settings values. The DeepSeek-on-NVIDIA thinking
// quirk (nvidia-provider.ts `this.model.includes('deepseek')`) is captured
// explicitly in extraParams on the kimki model rows that need it.
const MODELS = [
  // scout: nvidia / mistral-small
  { providerName: 'nvidia', displayName: 'Mistral Small 4', modelName: 'mistralai/mistral-small-4-119b-2603', supportsVision: true, supportsJsonMode: true, defaultTemperature: 0.2 },
  // extraction: nvidia / kimi-k2.6 — needs the thinking:false quirk? No — that's deepseek-on-nvidia. Kimi runs native.
  { providerName: 'nvidia', displayName: 'Kimi K2.6', modelName: 'moonshotai/kimi-k2.6', supportsVision: true, supportsJsonMode: true, defaultTemperature: 0.2 },
  // enhancement: deepseek / deepseek-v4-flash
  { providerName: 'deepseek', displayName: 'DeepSeek V4 Flash', modelName: 'deepseek-v4-flash', supportsVision: false, supportsJsonMode: true, defaultTemperature: 0.7 },
  // summarization: nvidia / llama-3.2-90b-vision
  { providerName: 'nvidia', displayName: 'Llama 3.2 90B Vision', modelName: 'meta/llama-3.2-90b-vision-instruct', supportsVision: true, supportsJsonMode: true, defaultTemperature: 0.5 },
  // generation: deepseek / deepseek-v4-flash (same model as enhancement, separate row)
  { providerName: 'deepseek', displayName: 'DeepSeek V4 Flash (Generation)', modelName: 'deepseek-v4-flash', supportsVision: false, supportsJsonMode: true, defaultTemperature: 0.7 },
];

// ── Stage config definitions (mirrors the retired ingestion_* settings) ───────
// callDelaySec / temperature reproduce the old seed-settings values; batch/concurrency come from there too.
const STAGES = [
  { stage: 'scout', providerName: 'nvidia', modelIndex: 0, temperature: 0.2, callDelaySec: 15, batchSize: null, concurrency: null },
  { stage: 'extraction', providerName: 'nvidia', modelIndex: 1, temperature: 0.2, callDelaySec: 15, batchSize: 2, concurrency: null },
  { stage: 'enhancement', providerName: 'deepseek', modelIndex: 2, temperature: 0.7, callDelaySec: 0, batchSize: null, concurrency: 10 },
  { stage: 'summarization', providerName: 'nvidia', modelIndex: 3, temperature: 0.5, callDelaySec: 15, batchSize: null, concurrency: null },
  { stage: 'generation', providerName: 'deepseek', modelIndex: 4, temperature: 0.7, callDelaySec: 0, batchSize: null, concurrency: null },
];

async function main() {
  console.log('🌱 Seeding AI providers, models, and stage configs...');

  // 1. Providers
  const providerIdByName = new Map<string, string>();
  for (const p of PROVIDERS) {
    const created = await prisma.aIProvider.upsert({
      where: { name: p.name },
      update: {
        displayName: p.displayName,
        description: p.description,
        protocol: p.protocol,
        baseUrl: p.baseUrl,
        minCallIntervalMs: p.minCallIntervalMs,
        // Only overwrite the encrypted key if the env var is currently set;
        // a seeded row with no key keeps the existing cipher untouched.
        ...(p.apiKeyCipher ? { apiKeyCipher: p.apiKeyCipher } : {}),
      },
      create: {
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        protocol: p.protocol,
        baseUrl: p.baseUrl,
        apiKeyCipher: p.apiKeyCipher,
        minCallIntervalMs: p.minCallIntervalMs,
      },
    });
    providerIdByName.set(p.name, created.id);
    console.log(`✅ Provider: ${p.name} (${p.protocol}) — key ${p.apiKeyCipher ? 'set' : 'absent'}`);
  }

  // 2. Models
  const modelIdByIndex = new Map<number, string>();
  for (let i = 0; i < MODELS.length; i++) {
    const m = MODELS[i];
    const providerId = providerIdByName.get(m.providerName);
    if (!providerId) {
      throw new Error(`Provider "${m.providerName}" not found for model "${m.modelName}"`);
    }
    const created = await prisma.aIModel.upsert({
      where: { providerId_modelName: { providerId, modelName: m.modelName } },
      update: {
        displayName: m.displayName,
        supportsVision: m.supportsVision,
        supportsJsonMode: m.supportsJsonMode,
        defaultTemperature: m.defaultTemperature,
      },
      create: {
        providerId,
        displayName: m.displayName,
        modelName: m.modelName,
        supportsVision: m.supportsVision,
        supportsJsonMode: m.supportsJsonMode,
        defaultTemperature: m.defaultTemperature,
        isActive: true,
      },
    });
    modelIdByIndex.set(i, created.id);
    console.log(`✅ Model: ${m.providerName} → ${m.displayName} (${m.modelName})`);
  }

  // 3. Stage configs
  for (const s of STAGES) {
    const modelId = modelIdByIndex.get(s.modelIndex);
    if (!modelId) {
      throw new Error(`Model not found for stage "${s.stage}"`);
    }
    await prisma.ingestionStageConfig.upsert({
      where: { stage: s.stage },
      update: {
        modelId,
        temperature: s.temperature,
        callDelaySec: s.callDelaySec,
        batchSize: s.batchSize,
        concurrency: s.concurrency,
        isActive: true,
      },
      create: {
        stage: s.stage,
        modelId,
        temperature: s.temperature,
        callDelaySec: s.callDelaySec,
        batchSize: s.batchSize,
        concurrency: s.concurrency,
        isActive: true,
      },
    });
    providerIdByName.get(s.providerName); // just to exercise the var
    console.log(`✅ Stage: ${s.stage} → model index ${s.modelIndex} (temp=${s.temperature}, delay=${s.callDelaySec}s)`);
  }

  console.log('✨ AI provider/model/stage seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
