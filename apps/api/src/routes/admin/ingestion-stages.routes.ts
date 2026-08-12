import { Router, Request, Response } from 'express';
import { prisma } from '@trivioq/database';
import { invalidateProviderCache } from '../../ai-question-ingestion/providers/registry';

const router = Router();

const VALID_STAGES = new Set(['scout', 'extraction', 'enhancement', 'summarization', 'generation']);

function serializeStage(s: any) {
  return {
    stage: s.stage,
    model: s.model
      ? {
          id: s.model.id,
          displayName: s.model.displayName,
          modelName: s.model.modelName,
          provider: s.model.provider ? { id: s.model.provider.id, name: s.model.provider.name, displayName: s.model.provider.displayName, protocol: s.model.provider.protocol } : null,
        }
      : null,
    modelId: s.modelId,
    temperature: s.temperature,
    callDelaySec: s.callDelaySec,
    batchSize: s.batchSize,
    concurrency: s.concurrency,
    specialInstruction: s.specialInstruction,
    isActive: s.isActive,
    updatedAt: s.updatedAt,
  };
}

/**
 * @route   GET /api/v1/admin/ingestion-stages
 * @desc    List all 5 ingestion stage configs with their model + provider
 * @access  Private (Admin Only)
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const stages = await prisma.ingestionStageConfig.findMany({
      orderBy: { stage: 'asc' },
      include: { model: { include: { provider: true } } },
    });
    return res.status(200).json({ success: true, data: stages.map(serializeStage) });
  } catch (error: any) {
    console.error('Error fetching ingestion stage configs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/v1/admin/ingestion-stages/:stage
 * @desc    Upsert a stage config by its stage key.
 * @access  Private (Admin Only)
 */
router.put('/:stage', async (req: Request, res: Response) => {
  try {
    const { stage } = req.params;
    if (!VALID_STAGES.has(stage)) {
      return res.status(400).json({ error: `stage must be one of: ${[...VALID_STAGES].join(', ')}` });
    }

    const { modelId, temperature, callDelaySec, batchSize, concurrency, specialInstruction, isActive } = req.body;

    // Validate modelId if provided (must exist + be active).
    if (modelId) {
      const model = await prisma.aIModel.findUnique({ where: { id: modelId, isActive: true } });
      if (!model) {
        return res.status(400).json({ error: 'Referenced modelId is inactive or does not exist.' });
      }
    }

    // Fetch the existing record BEFORE the upsert so we can invalidate the OLD model's
    // cached provider instance. The new modelId is not yet in the cache, so only
    // invalidating it (as before) was a no-op — the stale old model stayed cached for 60s.
    const existingStage = await prisma.ingestionStageConfig.findUnique({ where: { stage } });

    const upserted = await prisma.ingestionStageConfig.upsert({
      where: { stage },
      update: {
        ...(modelId !== undefined && { modelId }),
        ...(temperature !== undefined && { temperature }),
        ...(callDelaySec !== undefined && { callDelaySec }),
        ...(batchSize !== undefined && { batchSize }),
        ...(concurrency !== undefined && { concurrency }),
        ...(specialInstruction !== undefined && { specialInstruction }),
        ...(isActive !== undefined && { isActive }),
      },
      create: {
        stage,
        modelId: modelId ?? null,
        temperature: temperature ?? 0.2,
        callDelaySec: callDelaySec ?? 10,
        batchSize: batchSize ?? null,
        concurrency: concurrency ?? null,
        specialInstruction: specialInstruction ?? null,
        isActive: isActive ?? true,
      },
      include: { model: { include: { provider: true } } },
    });

    // Invalidate the OLD model (the one that was cached) so the next job picks up
    // the new configuration immediately instead of serving a stale 60s cache hit.
    if (existingStage?.modelId && existingStage.modelId !== modelId) {
      invalidateProviderCache(existingStage.modelId);
    }
    // Also invalidate the new modelId in case it was previously cached under a different config.
    if (modelId) invalidateProviderCache(modelId);

    return res.status(200).json({ success: true, data: serializeStage(upserted) });
  } catch (error: any) {
    console.error('Error upserting ingestion stage config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const ingestionStagesRouter = router;
