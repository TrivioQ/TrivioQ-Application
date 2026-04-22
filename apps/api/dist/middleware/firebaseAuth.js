'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.verifyFirebaseToken = void 0;
const admin = __importStar(require('firebase-admin'));
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
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    // Verify the ID token using the Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    // Attach the decoded Firebase uid and email to the request object
    req.firebaseUid = decodedToken.uid;
    req.firebaseEmail = decodedToken.email;
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
exports.verifyFirebaseToken = verifyFirebaseToken;
