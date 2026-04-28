import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';
import { requireAdmin } from '../middleware/require-admin';

const router = express.Router();

const UpdateLegalSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1),
  version: z.string().optional(),
});

// GET /api/v1/legal/:slug — public
router.get('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const doc = await prisma.legalDocument.findUnique({ where: { slug } });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  return res.json(doc);
});

// PUT /api/v1/legal/:slug — admin only
router.put('/:slug', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const parsed = UpdateLegalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const adminEmail = (req as any).user?.email ?? null;

  const doc = await prisma.legalDocument.upsert({
    where: { slug },
    update: { ...parsed.data, updatedBy: adminEmail },
    create: {
      slug,
      title: parsed.data.title ?? slug,
      content: parsed.data.content,
      version: parsed.data.version ?? '1.0',
      updatedBy: adminEmail,
    },
  });

  return res.json(doc);
});

export default router;
