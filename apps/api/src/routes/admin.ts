import { Router, Request, Response } from 'express';
import { PrismaClient } from '@trivioq/database';
import { verifyFirebaseToken } from '../middleware/firebase-auth';
import { requireAdmin } from '../middleware/require-admin';
import { cronJobsRouter } from './admin/cron-jobs';
import { ingestionRouter } from './admin/ingestion.routes';
import { settingsRouter } from './admin/settings.routes';
import { aiProvidersRouter } from './admin/ai-providers.routes';
import { aiModelsRouter } from './admin/ai-models.routes';
import { ingestionStagesRouter } from './admin/ingestion-stages.routes';

const router = Router();
const prisma = new PrismaClient();

// Apply both middlewares to all routes in this router
router.use(verifyFirebaseToken);
router.use(requireAdmin);

/**
 * @route   PUT /api/v1/admin/users/:id/tier
 * @desc    Toggle or set a user's subscription tier
 * @access  Private (Admin Only)
 */
router.put('/users/:id/tier', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tier } = req.body; // Expect 'FREE' or 'PREMIUM'

    if (!tier || (tier !== 'FREE' && tier !== 'PREMIUM')) {
      return res.status(400).json({ error: 'Invalid tier provided.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { subscriptionTier: tier },
    });

    return res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Failed to update user tier:', error);
    return res.status(500).json({ error: 'Internal server error while updating tier.' });
  }
});

// Admin Cron Jobs routes
router.use('/cron-jobs', cronJobsRouter);

// Admin Ingestion routes
router.use('/ingestion', ingestionRouter);

// Admin Settings routes
router.use('/settings', settingsRouter);

// Admin AI provider / model / stage-config management
router.use('/ai-providers', aiProvidersRouter);
router.use('/ai-models', aiModelsRouter);
router.use('/ingestion-stages', ingestionStagesRouter);

/**
 * @route   GET /api/v1/admin/users/:id/friendships
 * @desc    Get all friendships for a specific user
 * @access  Private (Admin Only)
 */
router.get('/users/:id/friendships', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: id }, { addresseeId: id }],
      },
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, email: true },
        },
        addressee: {
          select: { id: true, username: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: friendships,
    });
  } catch (error) {
    console.error('Failed to fetch user friendships:', error);
    return res.status(500).json({ error: 'Internal server error while fetching friendships.' });
  }
});

/**
 * @route   DELETE /api/v1/admin/friendships/:id
 * @desc    Forcefully remove a friendship or pending request
 * @access  Private (Admin Only)
 */
router.delete('/friendships/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.friendship.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Friendship removed successfully.',
    });
  } catch (error) {
    console.error('Failed to remove friendship:', error);
    return res.status(500).json({ error: 'Internal server error while removing friendship.' });
  }
});

export default router;
