'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = __importDefault(require('express'));
const zod_1 = require('zod');
const database_1 = require('@trivioq/database');
const router = express_1.default.Router();
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UserPreferencesSchema = zod_1.z.object({
  theme: zod_1.z.enum(['light', 'dark', 'system']),
  notificationsEnabled: zod_1.z.boolean(),
  language: zod_1.z.string(),
  categoryPercentages: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).refine(
    (data) => {
      const sum = Object.values(data).reduce((acc, val) => acc + val, 0);
      return Math.abs(sum - 1.0) < 0.001; // Handle floating point precision
    },
    { message: 'Percentages must add up to 1.0' },
  ),
  activeWindowStart: zod_1.z.string().regex(timeRegex, 'Invalid 24h time format'),
  activeWindowEnd: zod_1.z.string().regex(timeRegex, 'Invalid 24h time format'),
});
// Middleware to mock authentication (extract user ID)
const requireAuth = (req, res, next) => {
  // In a real application, this would verify a JWT and set req.userId
  req.userId = req.headers['x-user-id'] || 'default-user-id';
  next();
};
router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const payload = UserPreferencesSchema.parse(req.body);
    const userId = req.userId;
    // Convert "HH:MM" to a generic DateTime for the User model
    const now = new Date();
    const [startHour, startMin] = payload.activeWindowStart.split(':').map(Number);
    const [endHour, endMin] = payload.activeWindowEnd.split(':').map(Number);
    const activeWindowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
    const activeWindowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin);
    // Upsert preferences into the database
    const updatedUser = await database_1.prisma.user.upsert({
      where: { id: userId },
      update: {
        activeWindowStart,
        activeWindowEnd,
        preferences: payload,
      },
      create: {
        id: userId,
        firebaseUid: `mock_${userId}`, // Dummy value for mock
        email: `mock_${userId}@example.com`, // Dummy value for mock
        username: `user_${userId}`, // Dummy username for the mock
        activeWindowStart,
        activeWindowEnd,
        preferences: payload,
      },
    });
    res.json({
      message: 'Preferences updated successfully',
      preferences: updatedUser.preferences,
    });
  } catch (error) {
    if (error instanceof zod_1.z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.format() });
    }
    console.error('Failed to update preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await database_1.prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, cumulativeScore: true, preferences: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
exports.default = router;
