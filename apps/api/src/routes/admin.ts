import { Router, Request, Response } from 'express';
import { PrismaClient } from '@trivioq/database';
import { verifyFirebaseToken } from '../middleware/firebase-auth';
import { requireAdmin } from '../middleware/require-admin';

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

export default router;
