import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';
import { requireAdmin } from '../middleware/require-admin';

const router = express.Router();

const FAQSchema = z.object({
  question: z.string().min(5),
  answer: z.string().min(10),
  order: z.number().int().default(0),
  active: z.boolean().default(true),
});

// ── PUBLIC ROUTES ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/faqs
 * Returns all active FAQs ordered by "order"
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { selectedCategory } = req.query as { selectedCategory?: string };
    const questionQuery: any = { active: true };

    if (selectedCategory) {
      questionQuery.categories = { some: { name: selectedCategory } };
    }

    const faqs = await prisma.fAQ.findMany({
      where: questionQuery,
      orderBy: { order: 'asc' },
    });
    res.json(faqs);
  } catch (error) {
    console.error('[FAQ_GET] Failed:', error);
    res.status(500).json({ message: 'Failed to fetch FAQs' });
  }
});

// ── ADMIN ROUTES ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/faqs/admin
 * Returns all FAQs (including inactive) for management
 */
router.get('/admin', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const faqs = await prisma.fAQ.findMany({
      orderBy: { order: 'asc' },
    });
    res.json(faqs);
  } catch {
    res.status(500).json({ message: 'Failed to fetch FAQs for admin' });
  }
});

/**
 * POST /api/v1/faqs
 * Create a new FAQ
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = FAQSchema.parse(req.body);
    const faq = await prisma.fAQ.create({ data });
    res.status(201).json(faq);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    res.status(500).json({ message: 'Failed to create FAQ' });
  }
});

/**
 * PATCH /api/v1/faqs/:id
 * Update an existing FAQ
 */
router.patch('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = FAQSchema.partial().parse(req.body);
    const faq = await prisma.fAQ.update({
      where: { id },
      data,
    });
    res.json(faq);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    res.status(500).json({ message: 'Failed to update FAQ' });
  }
});

/**
 * DELETE /api/v1/faqs/:id
 * Remove an FAQ
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.fAQ.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Failed to delete FAQ' });
  }
});

export default router;
