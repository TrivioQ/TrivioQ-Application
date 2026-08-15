import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { prisma } from '@trivioq/database';

import { env } from '../config/env';

export type DecodedToken = admin.auth.DecodedIdToken;

// Initialize Firebase Admin if it hasn't been initialized yet.
if (!admin.apps.length) {
  try {
    let config = {};

    if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      config = {
        credential: admin.credential.cert(env.FIREBASE_SERVICE_ACCOUNT_PATH),
      };
      console.log(`Firebase Admin: Initializing with service account from file: ${env.FIREBASE_SERVICE_ACCOUNT_PATH}`);
    } else if (env.FIREBASE_SERVICE_ACCOUNT && env.FIREBASE_SERVICE_ACCOUNT !== '{}') {
      try {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        config = {
          credential: admin.credential.cert(serviceAccount),
        };
        console.log('Firebase Admin: Initializing with service account from JSON string.');
      } catch (e) {
        console.error('Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON string.', e);
      }
    } else {
      console.warn('Firebase Admin: No service account found. Falling back to default credentials.');
    }

    admin.initializeApp(config);
    console.log('Firebase Admin initialized for authentication.');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

/**
 * verifyFirebaseToken — lightweight middleware used by the /auth/sync route.
 * Sets req.firebaseUid and req.firebaseEmail; does NOT look up Postgres.
 */
export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).firebaseUid = decodedToken.uid;
    (req as any).firebaseEmail = decodedToken.email;
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

/**
 * verifyAnyFirebaseToken — lightweight dual-mode middleware (no Postgres
 * lookup), the session-cookie-aware counterpart of verifyFirebaseToken. Used by
 * the admin router, which receives session cookies as Bearer from the admin
 * app's proxy. NOTE: /auth/sync must stay on verifyFirebaseToken (idToken-only)
 * because it receives a raw idToken at login to mint the session cookie.
 */
export const verifyAnyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await verifyAnyToken(token);
    (req as any).firebaseUid = decodedToken.uid;
    (req as any).firebaseEmail = decodedToken.email;
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

/**
 * requireAuth — full auth middleware for all protected routes.
 * Verifies the Firebase Bearer token AND resolves the internal Postgres userId.
 *
 * After this middleware runs, handlers can safely read:
 *   (req as any).userId      — Postgres user UUID
 *   (req as any).firebaseUid — Firebase UID
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const firebaseUid = decoded.uid;

    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found. Please complete sign-up.' });
    }

    (req as any).userId = user.id;
    (req as any).firebaseUid = firebaseUid;
    next();
  } catch (error: any) {
    console.error('[requireAuth] Token verification failed:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Unauthorized: Session expired',
        code: 'auth/id-token-expired',
      });
    }

    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

/**
 * verifyAnyToken — accepts either a Firebase session cookie (web/admin) or a
 * Firebase ID token (mobile Client SDK). Session cookies are tried first; if
 * that fails we fall back to ID-token verification so mobile's short-lived
 * Bearer flow keeps working unchanged. Both return the same DecodedIdToken.
 */
export async function verifyAnyToken(token: string): Promise<DecodedToken> {
  try {
    return await admin.auth().verifySessionCookie(token, false);
  } catch {
    return await admin.auth().verifyIdToken(token);
  }
}

/**
 * requireSession — protected-route middleware replacing requireAuth.
 * Dual-mode: verifies a session cookie OR an ID token, then resolves the
 * Postgres userId. Same request additions and 401 shape as requireAuth so the
 * client-side 401/logout handling keeps working.
 */
export const requireSession = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await verifyAnyToken(token);
    const firebaseUid = decoded.uid;

    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found. Please complete sign-up.' });
    }

    (req as any).userId = user.id;
    (req as any).firebaseUid = firebaseUid;
    next();
  } catch (error: any) {
    console.error('[requireSession] Token verification failed:', error);

    if (error.code === 'auth/id-token-expired' || error.code === 'auth/session-cookie-expired') {
      return res.status(401).json({
        error: 'Unauthorized: Session expired',
        code: 'auth/id-token-expired',
      });
    }

    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
