import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';
import { verifyFirebaseToken } from '../middleware/firebase-auth';
import { getSetting } from '../utils/settings';

const router = express.Router();

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
      // Returning user — just bump lastLogin, don't overwrite profile
      const user = await prisma.user.update({
        where: { firebaseUid },
        data: { lastLogin: now },
      });
      return res.json(user);
    }

    // ── Brand new user — validate and persist with username + displayName ─────
    let username: string;
    let dob: Date;
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
      // Default DOB to 18 years ago
      dob = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
    } else {
      username = requestedUsername.toLowerCase().trim();

      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
      }

      if (!/^[a-z0-9_.]+$/.test(username)) {
        return res.status(400).json({ error: 'Username may only contain lowercase letters, numbers, underscores, and periods.' });
      }

      // ── Validate date of birth (must be at least 13 years old) ───────────────
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
      dob = parsedDob;
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

    res.json(user);
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

    console.log(`Deleting account for user: ${email} (${firebaseUid})`);

    // 1. Delete from database
    await prisma.user.delete({ where: { firebaseUid } });

    // 2. Delete from Firebase
    await admin.auth().deleteUser(firebaseUid);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
