import express from 'express';
import { prisma } from '@trivioq/database';

const router = express.Router();

// Public read of all categories. Used by the web onboarding wizard and the settings page.
// No authentication required — this is reference data with no PII.
router.get('/list', async (_req, res) => {
  try {
    const rows = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
    res.json({ categories: rows });
  } catch (error) {
    console.error('[categories/list] Failed to fetch categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
