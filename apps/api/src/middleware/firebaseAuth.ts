import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if it hasn't been initialized yet
// Note: In a production environment, ensure GOOGLE_APPLICATION_CREDENTIALS
// is set in the environment variables pointing to the service account JSON file.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // credential: admin.credential.cert(serviceAccount) // If using explicit cert file
    });
    console.log('Firebase Admin initialized for authentication.');
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the ID token using the Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Attach the decoded Firebase uid and email to the request object
    (req as any).firebaseUid = decodedToken.uid;
    (req as any).firebaseEmail = decodedToken.email;

    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
