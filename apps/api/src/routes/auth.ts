import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';
import { verifyFirebaseToken, requireSession } from '../middleware/firebase-auth';
import { getSetting } from '../utils/settings';
import { env } from '../config/env';

const router = express.Router();

/** Mint a long-lived Firebase session cookie from a fresh ID token. */
async function mintSessionCookie(req: Request): Promise<string> {
  const authHeader = req.headers.authorization;
  const idToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : '';
  return admin.auth().createSessionCookie(idToken, { expiresIn: env.SESSION_COOKIE_MAX_AGE_MS });
}

router.post('/sync', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const email = (req as any).firebaseEmail;

    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'Missing required Firebase claims (uid or email)' });
    }

    // Optional profile fields — only provided on initial sign-up (not on subsequent logins)
    const { username: requestedUsername, displayName: requestedDisplayName, dateOfBirth: requestedDob, referralCode } = req.body ?? {};

    const now = new Date();

    // ── Check if user already exists ──────────────────────────────────────────
    const existingUser = await prisma.user.findUnique({ where: { firebaseUid } });

    if (existingUser) {
      if (existingUser.accountStatus === 'PENDING_DELETION') {
        return res.status(403).json({ error: 'ACCOUNT_PENDING_DELETION', message: 'Your account is scheduled for deletion.' });
      }

      // Returning user — just bump lastLogin, don't overwrite profile
      const user = await prisma.user.update({
        where: { firebaseUid },
        data: { lastLogin: now },
      });

      try {
        const sessionCookie = await mintSessionCookie(req);
        return res.json({ ...user, sessionCookie });
      } catch (err) {
        console.error('[/sync] Failed to mint session cookie:', err);
        return res.status(403).json({ error: 'SESSION_MINT_FAILED' });
      }
    }

    // ── Brand new user — validate and persist with username + displayName ─────
    let username: string;
    let dob: string;
    let displayName: string;

    if (!requestedUsername) {
      // Fallback/deadlock resolution: If a user exists in Firebase but not in Postgres,
      // and they are trying to log in (not sign up), auto-generate username from email.
      const emailPrefix = email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
      let candidateUsername = emailPrefix;
      if (candidateUsername.length < 3) {
        candidateUsername = candidateUsername + '_tq';
      }
      candidateUsername = candidateUsername.substring(0, 30);

      // Verify uniqueness
      let conflict = await prisma.user.findUnique({ where: { username: candidateUsername } });
      let counter = 1;
      while (conflict) {
        candidateUsername = `${emailPrefix.substring(0, 25)}_${counter}`;
        conflict = await prisma.user.findUnique({ where: { username: candidateUsername } });
        counter++;
      }
      username = candidateUsername;
      displayName = requestedDisplayName?.trim() || email.split('@')[0];
      // Default DOB to 18 years ago as YYYY-MM-DD
      const date18YearsAgo = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
      dob = date18YearsAgo.toISOString().split('T')[0];
    } else {
      username = requestedUsername.toLowerCase().trim();

      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
      }

      if (!/^[a-z0-9_.]+$/.test(username)) {
        return res.status(400).json({ error: 'Username may only contain lowercase letters, numbers, underscores, and periods.' });
      }

      // ── Validate date of birth (must be at least 8 years old) ───────────────
      if (!requestedDob) {
        return res.status(400).json({ error: 'Date of birth is required.' });
      }

      const parsedDob = new Date(requestedDob);
      if (isNaN(parsedDob.getTime())) {
        return res.status(400).json({ error: 'Invalid date of birth.' });
      }

      const minAgeDate = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
      if (parsedDob > minAgeDate) {
        return res.status(400).json({ error: 'You must be at least 13 years old to create an account.' });
      }
      // Set the string natively for DB insertion
      dob = requestedDob;
      displayName = requestedDisplayName?.trim() || username;
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

    // Validate referral code — it must be an existing user's ID
    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { id: referralCode }, select: { id: true } });
      if (referrer) referredById = referrer.id;
    }

    let user;
    try {
      user = await prisma.user.create({
        data: {
          firebaseUid,
          email,
          username,
          displayName,
          dateOfBirth: dob,
          currentStreak: 0,
          cumulativeScore: 0,
          activeWindowStart,
          activeWindowEnd,
          lastLogin: now,
          preferences: {
            difficultyPercentages: { EASY: 20, MEDIUM: 70, HARD: 10 },
          },
          ...(referredById ? { referredById } : {}),
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
      const supportEmail = await getSetting('support_email', 'support@trivioq.com');
      return res.status(500).json({
        error: 'Account creation failed. Please try signing up again.',
        support: supportEmail,
      });
    }

    try {
      const sessionCookie = await mintSessionCookie(req);
      res.json({ ...user, sessionCookie });
    } catch (err) {
      console.error('[/sync] Failed to mint session cookie:', err);
      res.status(403).json({ error: 'SESSION_MINT_FAILED' });
    }
  } catch (error) {
    console.error('Failed to sync user with Firebase Auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const email = (req as any).firebaseEmail;

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Marking account for deletion: ${email} (${firebaseUid})`);

    const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // 1. Update database status to pending deletion
    await prisma.user.update({
      where: { firebaseUid },
      data: {
        accountStatus: 'PENDING_DELETION',
        scheduledDeletionAt,
        deletionWarningSent: false,
      },
    });

    // We do NOT delete from Firebase yet so they can log back in to reactivate.

    res.json({ message: 'Account marked for deletion in 30 days' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/reactivate', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.update({
      where: { firebaseUid },
      data: {
        accountStatus: 'ACTIVE',
        scheduledDeletionAt: null,
        deletionWarningSent: false,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Failed to reactivate user account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', requireSession, async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const { newPassword } = req.body ?? {};

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    await admin.auth().updateUser(firebaseUid, { password: newPassword });
    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('[/change-password] Failed to update password:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
