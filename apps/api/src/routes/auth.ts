import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';
import { verifyFirebaseToken } from '../middleware/firebaseAuth';

const router = express.Router();

router.post('/sync', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const email = (req as any).firebaseEmail;

    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'Missing required Firebase claims (uid or email)' });
    }

    // Optional profile fields — only provided on initial sign-up (not on subsequent logins)
    const { username: requestedUsername, displayName: requestedDisplayName } = req.body ?? {};

    const now = new Date();

    // ── Check if user already exists ──────────────────────────────────────────
    const existingUser = await prisma.user.findUnique({ where: { firebaseUid } });

    if (existingUser) {
      // Returning user — just bump lastLogin, don't overwrite profile
      const user = await prisma.user.update({
        where: { firebaseUid },
        data: { lastLogin: now },
      });
      return res.json(user);
    }

    // ── Brand new user — validate and persist with username + displayName ─────
    if (!requestedUsername) {
      return res.status(400).json({ error: 'Username is required for new accounts.' });
    }

    const username = requestedUsername.toLowerCase().trim();

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username may only contain lowercase letters, numbers, and underscores.' });
    }

    // ── Check username uniqueness ─────────────────────────────────────────────
    const usernameConflict = await prisma.user.findUnique({ where: { username } });
    if (usernameConflict) {
      return res.status(409).json({ error: 'USERNAME_TAKEN', message: 'That username is already taken. Please choose another.' });
    }

    // ── Check email uniqueness ────────────────────────────────────────────────
    const emailConflict = await prisma.user.findUnique({ where: { email } });
    if (emailConflict) {
      return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'An account with this email already exists.' });
    }

    // ── Create the user ───────────────────────────────────────────────────────
    const activeWindowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
    const activeWindowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          firebaseUid,
          email,
          username,
          displayName: requestedDisplayName?.trim() || username,
          currentStreak: 0,
          cumulativeScore: 0,
          activeWindowStart,
          activeWindowEnd,
          lastLogin: now,
        },
      });
    } catch (dbError) {
      // Roll back the Firebase account so the user can retry sign-up cleanly
      console.error('Failed to create user in database — rolling back Firebase account:', dbError);
      try {
        await admin.auth().deleteUser(firebaseUid);
        console.log(`Rolled back Firebase user ${firebaseUid}`);
      } catch (rollbackError) {
        console.error(`Failed to roll back Firebase user ${firebaseUid}:`, rollbackError);
      }
      return res.status(500).json({ error: 'Account creation failed. Please try signing up again.' });
    }

    res.json(user);
  } catch (error) {
    console.error('Failed to sync user with Firebase Auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
