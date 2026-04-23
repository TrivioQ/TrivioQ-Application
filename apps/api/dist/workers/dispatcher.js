"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const admin = __importStar(require("firebase-admin"));
const database_1 = require("@trivioq/database");
// Initialize Firebase Admin
// Make sure GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CONFIG is set in your env.
try {
    admin.initializeApp();
}
catch (error) {
    // Ignore if already initialized, otherwise log
    console.log('Firebase init status:', error);
}
const connection = new ioredis_1.default(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const dispatcherWorker = new bullmq_1.Worker('dispatch-notifications', async (job) => {
    const { userId, dropId, category, difficulty, expirationTimestamp } = job.data;
    console.log(`Processing push notification for user ${userId}, drop ${dropId}`);
    try {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { devicePushToken: true, id: true },
        });
        if (!user || !user.devicePushToken) {
            console.log(`Skipping notification: User ${userId} not found or missing devicePushToken.`);
            return;
        }
        const title = '🚨 New Trivioq Drop!';
        const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
        const body = `A ${capitalizedDifficulty} ${category} question is waiting. You have 15 minutes.`;
        const message = {
            notification: {
                title,
                body,
            },
            data: {
                dropId: dropId,
                expirationTimestamp: expirationTimestamp.toString(),
            },
            token: user.devicePushToken,
        };
        const response = await admin.messaging().send(message);
        console.log(`Successfully sent FCM message to user ${userId}:`, response);
    }
    catch (error) {
        console.error(`Failed to dispatch notification for user ${userId}:`, error);
        // Standard Firebase Admin error codes for invalid or unregistered tokens
        if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
            console.log(`Invalid token detected for user ${userId}. Cleaning up devicePushToken...`);
            await database_1.prisma.user.update({
                where: { id: userId },
                data: { devicePushToken: null },
            });
        }
        else {
            // Re-throw other transient errors so BullMQ can handle retries
            throw error;
        }
    }
}, { connection });
dispatcherWorker.on('completed', (job) => {
    console.log(`Dispatch job ${job.id} has completed!`);
});
dispatcherWorker.on('failed', (job, err) => {
    console.error(`Dispatch job ${job?.id} has failed:`, err);
});
console.log('Push notification dispatcher worker listening to "dispatch-notifications" queue...');
