import { Router, Request, Response } from 'express';
import { prisma } from '@trivioq/database';
import { invalidateProviderCache } from '../../ai-question-ingestion/providers/registry';

const router = Router();

// Keys the openai adapter merges into the request body itself; allowing them
// in extraParams would let an admin clobber temperature/model silently.
const RESERVED_EXTRA_PARAM_KEYS = new Set([
  'model',
  'messages',
  'max_tokens',
  'response_format',
  'temperature',
  'stream',
]);

function validateExtraParams(extraParams: unknown): string | null {
  if (extraParams == null) return null;
  if (typeof extraParams !== 'object' || Array.isArray(extraParams)) {
    return 'extraParams must be a JSON object.';
  }
  const obj = extraParams as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (RESERVED_EXTRA_PARAM_KEYS.has(key)) {
      return `extraParams key "${key}" is reserved — use the dedicated field instead.`;
    }
  }
  return null;
}

function serializeModel(m: any) {
  return {
    id: m.id,
    providerId: m.providerId,
    provider: m.provider ? { id: m.provider.id, name: m.provider.name, displayName: m.provider.displayName, protocol: m.provider.protocol } : null,
    displayName: m.displayName,
    description: m.description,
    modelName: m.modelName,
    contextWindow: m.contextWindow,
    maxOutputTokens: m.maxOutputTokens,
    supportsVision: m.supportsVision,
    supportsJsonMode: m.supportsJsonMode,
    defaultTemperature: m.defaultTemperature,
    extraParams: m.extraParams,
    isActive: m.isActive,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/**
 * @route   GET /api/v1/admin/ai-models
 * @desc    List all AI models, optionally filtered by ?providerId=
 * @access  Private (Admin Only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const where = req.query.providerId ? { providerId: String(req.query.providerId) } : undefined;
    const models = await prisma.aIModel.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { provider: true },
    });
    return res.status(200).json({ success: true, data: models.map(serializeModel) });
  } catch (error: any) {
    console.error('Error fetching AI models:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/v1/admin/ai-models
 * @desc    Create an AI model
 * @access  Private (Admin Only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { providerId, displayName, description, modelName, contextWindow, maxOutputTokens, supportsVision, supportsJsonMode, defaultTemperature, extraParams, isActive } = req.body;

    if (!providerId || !displayName || !modelName) {
      return res.status(400).json({ error: 'providerId, displayName, and modelName are required' });
    }

    const provider = await prisma.aIProvider.findUnique({ where: { id: providerId } });
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const extraParamsErr = validateExtraParams(extraParams);
    if (extraParamsErr) {
      return res.status(422).json({ error: extraParamsErr });
    }

    const created = await prisma.aIModel.create({
      data: {
        providerId,
        displayName,
        description: description ?? null,
        modelName,
        contextWindow: contextWindow ?? null,
        maxOutputTokens: maxOutputTokens ?? null,
        supportsVision: supportsVision ?? true,
        supportsJsonMode: supportsJsonMode ?? true,
        defaultTemperature: defaultTemperature ?? 0.2,
        extraParams: extraParams ?? null,
        isActive: isActive ?? true,
      },
      include: { provider: true },
    });

    return res.status(201).json({ success: true, data: serializeModel(created) });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: `Model "${req.body.modelName}" already exists on this provider.` });
    }
    console.error('Error creating AI model:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/v1/admin/ai-models/:id
 * @desc    Update an AI model
 * @access  Private (Admin Only)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { displayName, description, modelName, contextWindow, maxOutputTokens, supportsVision, supportsJsonMode, defaultTemperature, extraParams, isActive } = req.body;

    const existing = await prisma.aIModel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Model not found' });
    }

    if (extraParams !== undefined) {
      const extraParamsErr = validateExtraParams(extraParams);
      if (extraParamsErr) {
        return res.status(422).json({ error: extraParamsErr });
      }
    }

    const updated = await prisma.aIModel.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(modelName !== undefined && { modelName }),
        ...(contextWindow !== undefined && { contextWindow }),
        ...(maxOutputTokens !== undefined && { maxOutputTokens }),
        ...(supportsVision !== undefined && { supportsVision }),
        ...(supportsJsonMode !== undefined && { supportsJsonMode }),
        ...(defaultTemperature !== undefined && { defaultTemperature }),
        ...(extraParams !== undefined && { extraParams }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { provider: true },
    });

    invalidateProviderCache(id);

    return res.status(200).json({ success: true, data: serializeModel(updated) });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: `Model "${req.body.modelName}" already exists on this provider.` });
    }
    console.error('Error updating AI model:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/v1/admin/ai-models/:id
 * @desc    Delete an AI model. Refuses if a stage config still references it
 *          (admin must reassign the stage first).
 * @access  Private (Admin Only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.aIModel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const stageRefs = await prisma.ingestionStageConfig.count({ where: { modelId: id } });
    if (stageRefs > 0) {
      return res.status(409).json({ error: `Model is referenced by ${stageRefs} stage config(s). Reassign them before deleting.` });
    }

    await prisma.aIModel.delete({ where: { id } });
    invalidateProviderCache(id);
    return res.status(200).json({ success: true, message: 'Model deleted.' });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return res.status(409).json({ error: 'Model is still referenced. Reassign the stage configs first.' });
    }
    console.error('Error deleting AI model:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const aiModelsRouter = router;
