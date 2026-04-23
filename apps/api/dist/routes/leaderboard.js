"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("@trivioq/database");
const router = express_1.default.Router();
// Mock auth middleware (for demonstration)
const requireAuth = (req, res, next) => {
    req.userId = req.headers['x-user-id'] || 'default-user-id';
    next();
};
router.get('/friends', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        // Find all accepted friendships where the user is either the requester or the addressee
        const friendships = await database_1.prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ requesterId: userId }, { addresseeId: userId }],
            },
        });
        // Extract the IDs of the friends
        const friendIds = friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
        // Combine user's own ID with friend IDs
        const leaderboardIds = [userId, ...friendIds];
        // Fetch the users and sort them
        const leaderboard = await database_1.prisma.user.findMany({
            where: {
                id: { in: leaderboardIds },
            },
            select: {
                id: true,
                username: true,
                currentStreak: true,
                cumulativeScore: true,
            },
            orderBy: {
                cumulativeScore: 'desc',
            },
        });
        res.json({ leaderboard });
    }
    catch (error) {
        console.error('Failed to fetch friends leaderboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
