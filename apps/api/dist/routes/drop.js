"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("@trivioq/database");
const firebaseAuth_1 = require("../middleware/firebaseAuth");
const router = express_1.default.Router();
// Mock auth middleware (for demonstration)
const requireAuth = (req, res, next) => {
    req.userId = req.headers['x-user-id'] || 'default-user-id';
    next();
};
router.get('/active', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const now = new Date();
        const activeDrop = await database_1.prisma.userDrop.findFirst({
            where: {
                userId: userId,
                isAnswered: false,
                expirationTime: {
                    gt: now,
                },
            },
            include: {
                question: {
                    select: {
                        id: true,
                        categoryId: true,
                        difficultyLevel: true,
                        questionText: true,
                        choices: true,
                        // Explicitly omitted: correctAnswerId, explanationText
                    },
                },
            },
        });
        if (!activeDrop || !activeDrop.question) {
            return res.status(404).json({ error: 'No active drop found' });
        }
        const payload = {
            dropId: activeDrop.id,
            questionId: activeDrop.question.id,
            category: activeDrop.question.categoryId,
            difficulty: activeDrop.question.difficultyLevel.toLowerCase(),
            questionText: activeDrop.question.questionText,
            options: activeDrop.question.choices,
            expiresAt: activeDrop.expirationTime.getTime(),
        };
        res.json(payload);
    }
    catch (error) {
        console.error('Failed to fetch active drop:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:dropId/submit', requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const { dropId } = req.params;
        // Fallback to checking either selectedChoiceId from prompt or selectedOptionIndex from shared-types
        const selectedOptionIndex = req.body.selectedOptionIndex ?? req.body.selectedChoiceId;
        if (selectedOptionIndex === undefined) {
            return res.status(400).json({ error: 'Missing selectedOptionIndex in payload' });
        }
        const userDrop = await database_1.prisma.userDrop.findUnique({
            where: { id: dropId },
            include: { question: true, user: true },
        });
        if (!userDrop || userDrop.userId !== userId) {
            return res.status(404).json({ error: 'Drop not found' });
        }
        if (userDrop.isAnswered) {
            return res.status(400).json({ error: 'Drop already answered' });
        }
        const now = new Date();
        if (now > userDrop.expirationTime) {
            return res.status(410).json({ error: 'Drop has expired' });
        }
        const question = userDrop.question;
        const choices = question.choices;
        // Deduce correctOptionIndex (handle if DB stores stringified index or exact choice text)
        let correctOptionIndex = -1;
        if (!isNaN(Number(question.correctAnswerId))) {
            correctOptionIndex = Number(question.correctAnswerId);
        }
        else {
            correctOptionIndex = choices.indexOf(question.correctAnswerId);
        }
        const isCorrect = selectedOptionIndex === correctOptionIndex;
        const pointsAwarded = isCorrect ? 10 : 0; // Configurable scoring logic
        const [updatedUserDrop, updatedUser] = await database_1.prisma.$transaction([
            database_1.prisma.userDrop.update({
                where: { id: dropId },
                data: {
                    isAnswered: true,
                    wasCorrect: isCorrect,
                },
            }),
            database_1.prisma.user.update({
                where: { id: userId },
                data: {
                    currentStreak: isCorrect ? { increment: 1 } : 0,
                    cumulativeScore: { increment: pointsAwarded },
                },
            }),
        ]);
        const response = {
            isCorrect,
            correctOptionIndex,
            pointsAwarded,
            explanation: question.explanationText || undefined,
            newStreak: updatedUser.currentStreak,
            newTotalScore: updatedUser.cumulativeScore,
        };
        res.json(response);
    }
    catch (error) {
        console.error('Failed to submit drop:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/on-demand', firebaseAuth_1.verifyFirebaseToken, async (req, res) => {
    try {
        const firebaseUid = req.firebaseUid;
        const user = await database_1.prisma.user.findUnique({
            where: { firebaseUid },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.subscriptionTier === 'FREE') {
            return res.status(403).json({
                code: 'UPGRADE_REQUIRED',
                message: 'Instant drops are a Premium feature.',
            });
        }
        const now = new Date();
        let dropsReceivedToday = user.dropsReceivedToday;
        const isSameDay = user.lastDropDate.getUTCFullYear() === now.getUTCFullYear() && user.lastDropDate.getUTCMonth() === now.getUTCMonth() && user.lastDropDate.getUTCDate() === now.getUTCDate();
        if (!isSameDay) {
            dropsReceivedToday = 0;
        }
        if (dropsReceivedToday >= 100) {
            return res.status(429).json({ error: 'Too Many Requests' });
        }
        const questions = await database_1.prisma.question.findMany({
            select: {
                id: true,
                categoryId: true,
                difficultyLevel: true,
                questionText: true,
                choices: true,
            },
        });
        if (questions.length === 0) {
            return res.status(500).json({ error: 'No questions available' });
        }
        const randomQ = questions[Math.floor(Math.random() * questions.length)];
        const expirationTime = new Date(now.getTime() + 15 * 60000);
        const userDrop = await database_1.prisma.userDrop.create({
            data: {
                userId: user.id,
                questionId: randomQ.id,
                scheduledDropTime: now,
                expirationTime: expirationTime,
                isAnswered: false,
            },
        });
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: {
                dropsReceivedToday: dropsReceivedToday + 1,
                lastDropDate: now,
            },
        });
        const payload = {
            dropId: userDrop.id,
            questionId: randomQ.id,
            category: randomQ.categoryId,
            difficulty: randomQ.difficultyLevel.toLowerCase(),
            questionText: randomQ.questionText,
            options: randomQ.choices,
            expiresAt: expirationTime.getTime(),
        };
        return res.json(payload);
    }
    catch (error) {
        console.error('Failed to create on-demand drop:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
