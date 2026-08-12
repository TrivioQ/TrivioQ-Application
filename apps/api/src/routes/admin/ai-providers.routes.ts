import { Router, Request, Response } from 'express';
import { prisma, encrypt, maskCipher } from '@trivioq/database';
import { clearProviderCache, invalidateProviderCache } from '../../ai-question-ingestion/providers/registry';
import { resolveProvider } from '../../ai-question-ingestion/providers/registry';

const router = Router();

const PROTOCOLS = ['openai', 'anthropic', 'gemini', 'local_form'] as const;

/**
 * Shape returned to the admin UI. The apiKeyCipher is NEVER sent to the
 * browser — only a masked last-4 preview so the admin can tell whether a key
 * is set.
 */
function serializeProvider(p: any) {
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    apiKeyMasked: p.apiKeyCipher ? maskCipher(p.apiKeyCipher) : null,
    apiKeySet: Boolean(p.apiKeyCipher),
    defaultHeaders: p.defaultHeaders,
    minCallIntervalMs: p.minCallIntervalMs,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * @route   GET /api/v1/admin/ai-providers
 * @desc    List all AI providers (keys masked, never the cipher)
 * @access  Private (Admin Only)
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const providers = await prisma.aIProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return res.status(200).json({ success: true, data: providers.map(serializeProvider) });
  } catch (error: any) {
    console.error('Error fetching AI providers:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/v1/admin/ai-providers
 * @desc    Create an AI provider. apiKey is encrypted server-side.
 * @access  Private (Admin Only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, displayName, description, protocol, baseUrl, apiKey, defaultHeaders, minCallIntervalMs, isActive } = req.body;

    if (!name || !displayName || !protocol) {
      return res.status(400).json({ error: 'name, displayName, and protocol are required' });
    }
    if (!PROTOCOLS.includes(protocol)) {
      return res.status(400).json({ error: `protocol must be one of: ${PROTOCOLS.join(', ')}` });
    }

    const apiKeyCipher = apiKey ? encrypt(apiKey) : null;

    const created = await prisma.aIProvider.create({
      data: {
        name,
        displayName,
        description: description ?? null,
        protocol,
        baseUrl: baseUrl ?? null,
        apiKeyCipher,
        defaultHeaders: defaultHeaders ?? null,
        minCallIntervalMs: minCallIntervalMs ?? 0,
        isActive: isActive ?? true,
      },
    });

    return res.status(201).json({ success: true, data: serializeProvider(created) });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: `A provider named "${req.body.name}" already exists.` });
    }
    console.error('Error creating AI provider:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/v1/admin/ai-providers/:id
 * @desc    Update an AI provider. If apiKey is omitted/blank, the existing
 *          key is preserved. If provided, it's re-encrypted.
 * @access  Private (Admin Only)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, displayName, description, protocol, baseUrl, apiKey, defaultHeaders, minCallIntervalMs, isActive } = req.body;

    if (protocol && !PROTOCOLS.includes(protocol)) {
      return res.status(400).json({ error: `protocol must be one of: ${PROTOCOLS.join(', ')}` });
    }

    const existing = await prisma.aIProvider.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Only re-encrypt when an explicit non-empty key is sent; blank/absent
    // means "keep the existing key" (write-only field on the client).
    const apiKeyCipher = apiKey ? encrypt(apiKey) : existing.apiKeyCipher;

    const updated = await prisma.aIProvider.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(protocol !== undefined && { protocol }),
        ...(baseUrl !== undefined && { baseUrl }),
        apiKeyCipher,
        ...(defaultHeaders !== undefined && { defaultHeaders }),
        ...(minCallIntervalMs !== undefined && { minCallIntervalMs }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Invalidate cached provider instances for any models on this provider
    // so the next call picks up the new key/connection.
    const models = await prisma.aIModel.findMany({ where: { providerId: id }, select: { id: true } });
    for (const m of models) invalidateProviderCache(m.id);

    return res.status(200).json({ success: true, data: serializeProvider(updated) });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: `A provider named "${req.body.name}" already exists.` });
    }
    console.error('Error updating AI provider:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/v1/admin/ai-providers/:id
 * @desc    Soft-delete a provider (isActive=false) so historical rows stay
 *          referencable. Hard delete if no models are attached.
 * @access  Private (Admin Only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.aIProvider.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const modelCount = await prisma.aIModel.count({ where: { providerId: id } });
    if (modelCount > 0) {
      // Soft-delete: keep the row so the FK on AIModel/IngestionStageConfig stays valid.
      const updated = await prisma.aIProvider.update({ where: { id }, data: { isActive: false } });
      const models = await prisma.aIModel.findMany({ where: { providerId: id }, select: { id: true } });
      for (const m of models) invalidateProviderCache(m.id);
      return res.status(200).json({ success: true, data: serializeProvider(updated), message: 'Provider deactivated (models exist — row preserved).' });
    }

    await prisma.aIProvider.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Provider deleted.' });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return res.status(409).json({ error: 'Provider is still referenced by stage configs. Reassign them first.' });
    }
    console.error('Error deleting AI provider:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/v1/admin/ai-providers/:id/test
 * @desc    Fire a tiny prompt against the provider's first active model to
 *          verify the key + baseUrl. Invalidates the cache for a fresh lookup.
 * @access  Private (Admin Only)
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const provider = await prisma.aIProvider.findUnique({ where: { id } });
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    if (!provider.isActive) {
      return res.status(400).json({ error: 'Provider is inactive' });
    }

    const testModel = await prisma.aIModel.findFirst({ where: { providerId: id, isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!testModel) {
      return res.status(400).json({ error: 'No active model on this provider to test. Create a model first.' });
    }

    invalidateProviderCache(testModel.id);
    clearProviderCache();

    const startedAt = Date.now();
    const resolved = await resolveProvider(testModel.id);
    // Reuse the generic provider's simplest method: summarize a one-char image
    // would need a real image, so use extractFromText with a trivial prompt.
    const result = await resolved.extractFromText('Say hello in one word.', 'Return the JSON { "questions": [] } as if this were a trivial empty input.', { temperature: 0 });
    const ok = Boolean(result && (result as any).questions);
    const elapsedMs = Date.now() - startedAt;

    return res.status(200).json({
      success: ok,
      message: ok ? `Connection OK — responded in ${elapsedMs}ms via model "${testModel.displayName}".` : 'Provider responded but the output shape was unexpected.',
      modelId: testModel.id,
      elapsedMs,
    });
  } catch (error: any) {
    console.error('Error testing AI provider:', error);
    return res.status(200).json({
      success: false,
      message: error?.message ?? 'Connection failed',
    });
  }
});

export const aiProvidersRouter = router;
