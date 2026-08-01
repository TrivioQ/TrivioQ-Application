import express, { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@trivioq/database';
import { requireAuth } from '../middleware/firebase-auth';

const router = express.Router();

const RequestSchema = z.object({
  addresseeId: z.string().uuid(),
});

const RespondSchema = z.object({
  requestId: z.string().uuid(),
});

// GET /api/friendships
// List all friends, pending incoming requests, and pending outgoing requests
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, profilePicture: true },
        },
        addressee: {
          select: { id: true, username: true, displayName: true, profilePicture: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const accepted = friendships
      .filter((f) => f.status === 'ACCEPTED')
      .map((f) => {
        const friend = f.requesterId === userId ? f.addressee : f.requester;
        return { friendshipId: f.id, friend, createdAt: f.createdAt };
      });

    const incomingRequests = friendships.filter((f) => f.status === 'PENDING' && f.addresseeId === userId).map((f) => ({ requestId: f.id, user: f.requester, createdAt: f.createdAt }));

    const outgoingRequests = friendships.filter((f) => f.status === 'PENDING' && f.requesterId === userId).map((f) => ({ requestId: f.id, user: f.addressee, createdAt: f.createdAt }));

    res.json({ accepted, incomingRequests, outgoingRequests });
  } catch (error) {
    console.error('Failed to fetch friendships:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friendships/request
// Send a friend request
router.post('/request', requireAuth, async (req: Request, res: Response) => {
  try {
    const { addresseeId } = RequestSchema.parse(req.body);
    const userId = (req as any).userId;

    if (userId === addresseeId) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    }

    // Check if a relationship already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: addresseeId },
          { requesterId: addresseeId, addresseeId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'BLOCKED') {
        return res.status(403).json({ error: 'Cannot send friend request' });
      }
      return res.status(400).json({ error: `Friendship or request already exists (Status: ${existing.status})` });
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId: userId,
        addresseeId: addresseeId,
        status: 'PENDING',
      },
    });

    res.status(201).json({ message: 'Friend request sent', friendship });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    console.error('Failed to send friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friendships/accept
// Accept a friend request
router.post('/accept', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requestId } = RespondSchema.parse(req.body);
    const userId = (req as any).userId;

    const request = await prisma.friendship.findUnique({ where: { id: requestId } });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (request.addresseeId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to accept this request' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request is not in a pending state' });
    }

    const updated = await prisma.friendship.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });

    res.json({ message: 'Friend request accepted', friendship: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    console.error('Failed to accept friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friendships/decline
// Decline a friend request
router.post('/decline', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requestId } = RespondSchema.parse(req.body);
    const userId = (req as any).userId;

    const request = await prisma.friendship.findUnique({ where: { id: requestId } });

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (request.addresseeId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to decline this request' });
    }

    // Declining simply removes the record
    await prisma.friendship.delete({ where: { id: requestId } });

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    console.error('Failed to decline friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friendships/block
// Block a user
router.post('/block', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userIdToBlock } = z.object({ userIdToBlock: z.string().uuid() }).parse(req.body);
    const userId = (req as any).userId;

    if (userId === userIdToBlock) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: userIdToBlock },
          { requesterId: userIdToBlock, addresseeId: userId },
        ],
      },
    });

    if (existing) {
      // Update existing record to blocked. Usually the requesterId becomes the blocker
      await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          status: 'BLOCKED',
          requesterId: userId, // Set current user as requester for directionality of block
          addresseeId: userIdToBlock,
        },
      });
    } else {
      await prisma.friendship.create({
        data: {
          requesterId: userId,
          addresseeId: userIdToBlock,
          status: 'BLOCKED',
        },
      });
    }

    res.json({ message: 'User blocked' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    console.error('Failed to block user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/friendships/remove/:id
// Remove an existing friend
router.delete('/remove/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const friendshipId = req.params.id;
    const userId = (req as any).userId;

    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to remove this friendship' });
    }

    await prisma.friendship.delete({ where: { id: friendshipId } });

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Failed to remove friend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
