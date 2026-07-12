import { PrismaClient, DifficultyLevel, SubscriptionTier, Role, PeriodType } from '@prisma/client';
process.env.TZ = 'UTC';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();
const OVERALL_PERIOD_START = new Date(0);

const DIFFICULTY_POINTS: Record<DifficultyLevel, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
};

const DROP_EXPIRY_MINUTES = 30;
const ANSWER_TIMER_SECONDS: Record<string, number> = {
  EASY: 60,
  MEDIUM: 180,
  HARD: 300,
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  // 🛑 Safety Guard: Prevent running in production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL ERROR: Mock data seeding is DISABLED in production to prevent data loss.');
    process.exit(1);
  }

  console.log('🚀 Starting mock data seeding...');

  try {
    await prisma.$transaction(
      async (tx) => {
        // 0. Cleanup existing data
        console.log('🧹 Stage 0: Clearing existing data...');
        // NOTE: PendingQuestion table must NOT be deleted/cleared here,
        // as they represent history of AI-generated questions and should persist.
        // Deleting in order to respect foreign key constraints
        await tx.userDrop.deleteMany();
        await tx.userScore.deleteMany();
        await tx.friendship.deleteMany();
        await tx.question.deleteMany();
        await tx.category.deleteMany();
        await tx.user.deleteMany();
        await tx.fAQ.deleteMany();
        await tx.legalDocument.deleteMany();
        await tx.setting.deleteMany();
        console.log('✅ Database cleared.');

        // 1. Categories
        console.log('📂 Stage 1: Creating categories...');
        const categoryNames = ['Tech', 'History', 'Movies', 'Sports', 'Science', 'Music', 'Geography', 'Art', 'Literature', 'Pop Culture'];

        const categories = await Promise.all(
          categoryNames.map((name) =>
            tx.category.upsert({
              where: { slug: name.toLowerCase().replace(/\s+/g, '-') },
              update: {},
              create: {
                name,
                slug: name.toLowerCase().replace(/\s+/g, '-'),
                description: faker.lorem.sentence(),
              },
            }),
          ),
        );
        console.log(`✅ Created ${categories.length} categories.`);

        // 2. Questions
        console.log('❓ Stage 2: Generating 500 questions...');
        const questionsData = [];
        const difficulties = Object.values(DifficultyLevel);

        for (let i = 0; i < 500; i++) {
          const correctIdx = faker.number.int({ min: 0, max: 3 });
          const choices = [0, 1, 2, 3].map((idx) => ({
            text: faker.lorem.words(3),
            order: idx,
            isCorrect: idx === correctIdx,
          }));

          // Pick 1-2 random categories
          const shuffledCats = [...categories].sort(() => 0.5 - Math.random());
          const selectedCats = shuffledCats.slice(0, faker.number.int({ min: 1, max: 2 }));

          questionsData.push({
            questionText: faker.lorem.sentence() + '?',
            difficultyLevel: difficulties[faker.number.int({ min: 0, max: difficulties.length - 1 })],
            choices: {
              create: choices,
            },
            explanationText: faker.lorem.paragraph(),
            hintText: faker.lorem.sentence(),
            categories: {
              connect: selectedCats.map((c) => ({ id: c.id })),
            },
          });
        }

        // We can't use createMany with relations in Prisma, so we do it in a loop or chunks
        // To speed up, we'll do them in parallel with Promise.all
        const createdQuestions = await Promise.all(
          questionsData.map((q) =>
            tx.question.create({
              data: q,
              include: { choices: true },
            }),
          ),
        );
        console.log(`✅ Created ${createdQuestions.length} questions.`);

        // 3. Users
        console.log('👤 Stage 3: Generating 100 users...');
        const users = [];
        for (let i = 0; i < 100; i++) {
          const tier = i < 80 ? SubscriptionTier.FREE : SubscriptionTier.PREMIUM;
          const currentStreak = faker.number.int({ min: 0, max: 15 });

          const now = new Date();
          const activeWindowStart = new Date(now.setUTCHours(8, 0, 0, 0));
          const activeWindowEnd = new Date(now.setUTCHours(20, 0, 0, 0));

          const user = await tx.user.create({
            data: {
              firebaseUid: faker.string.uuid(),
              email: faker.internet.email(),
              username: faker.internet.userName(),
              displayName: faker.person.fullName(),
              dateOfBirth: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
              profilePicture: faker.image.avatar(),
              currentStreak,
              subscriptionTier: tier,
              activeWindowStart,
              activeWindowEnd,
              role: Role.USER,
              preferences: {
                theme: 'system',
                notificationsEnabled: true,
                language: 'en',
                categoryPercentages: { tech: 0.5, science: 0.5 },
                difficultyPercentages: { easy: 50, medium: 30, hard: 20 },
                targetDropsPerWeek: 35,
              },
            },
          });
          users.push(user);
        }
        console.log('✅ Created 100 users.');

        // 4. User Drops (History)
        console.log('📥 Stage 4: Generating historical user drops (90 days)...');
        const userStatsMap: Record<
          string,
          {
            overall: number;
            weekly: Record<string, number>;
            monthly: Record<string, number>;
            questionsAnswered: number;
            correctAnswers: number;
          }
        > = {};

        for (const user of users) {
          userStatsMap[user.id] = { overall: 0, weekly: {}, monthly: {}, questionsAnswered: 0, correctAnswers: 0 };
          const numDrops = faker.number.int({ min: 50, max: 100 });

          for (let j = 0; j < numDrops; j++) {
            const isAnswered = faker.datatype.boolean();
            let wasCorrect = false;
            const scheduledDropTime = faker.date.recent({ days: 90 });
            const expirationTime = new Date(scheduledDropTime.getTime() + DROP_EXPIRY_MINUTES * 60000);
            const randomQ = createdQuestions[faker.number.int({ min: 0, max: createdQuestions.length - 1 })];

            let answeredAt = null;
            let pointsAwarded = 0;
            let usedHint = false;
            let revealedAnswer = false;
            let selectedChoiceId = null;
            let answerDeadline: Date | null = null;

            if (isAnswered) {
              userStatsMap[user.id].questionsAnswered++;
              // Simulate the reveal→answer flow: user reveals the question
              // after a short delay, which starts the per-difficulty countdown.
              const revealDelay = faker.number.int({ min: 1, max: 5 }) * 60000;
              const timerSeconds = ANSWER_TIMER_SECONDS[randomQ.difficultyLevel] ?? 60;
              answerDeadline = new Date(scheduledDropTime.getTime() + revealDelay + timerSeconds * 1000);
              answeredAt = new Date(scheduledDropTime.getTime() + faker.number.int({ min: 1, max: 10 }) * 60000);
              const successProb = user.subscriptionTier === SubscriptionTier.PREMIUM ? 0.8 : 0.6;

              // 30% chance they used a hint
              usedHint = Math.random() < 0.3;
              // 5% chance they gave up and revealed answer
              revealedAnswer = Math.random() < 0.05;

              if (revealedAnswer) {
                wasCorrect = false;
                selectedChoiceId = null;
              } else {
                wasCorrect = Math.random() < successProb;
                const choices = randomQ.choices as any[];
                const correctIdx = choices.findIndex((c) => c.isCorrect);
                const randomIdx = faker.number.int({ min: 0, max: 3 });
                selectedChoiceId = choices[wasCorrect ? correctIdx : randomIdx]?.id || null;

                if (wasCorrect) {
                  userStatsMap[user.id].correctAnswers++;
                  const basePts = DIFFICULTY_POINTS[randomQ.difficultyLevel];
                  const hintCost = usedHint ? Math.floor(basePts * 0.3) : 0;
                  pointsAwarded = basePts - hintCost;

                  const wKey = getWeekStart(scheduledDropTime).toISOString();
                  const mKey = getMonthStart(scheduledDropTime).toISOString();

                  userStatsMap[user.id].overall += pointsAwarded;
                  userStatsMap[user.id].weekly[wKey] = (userStatsMap[user.id].weekly[wKey] || 0) + pointsAwarded;
                  userStatsMap[user.id].monthly[mKey] = (userStatsMap[user.id].monthly[mKey] || 0) + pointsAwarded;
                }
              }
            }

            await tx.userDrop.create({
              data: {
                userId: user.id,
                questionId: randomQ.id,
                scheduledDropTime,
                expirationTime,
                isAnswered,
                wasCorrect,
                usedHint,
                revealedAnswer,
                answeredAt,
                pointsAwarded,
                selectedChoiceId,
                answerDeadline,
                isViewed: isAnswered || faker.datatype.boolean(),
                scheduledFor: scheduledDropTime,
                createdAt: scheduledDropTime,
              },
            });
          }

          // Update user's cumulativeScore and stats in the DB
          await tx.user.update({
            where: { id: user.id },
            data: {
              cumulativeScore: userStatsMap[user.id].overall,
              questionsAnswered: userStatsMap[user.id].questionsAnswered,
              correctAnswers: userStatsMap[user.id].correctAnswers,
            },
          });
        }
        console.log('✅ Generated historical drops and updated user cumulative scores.');

        // 5. Friendships
        console.log('🤝 Stage 5: Creating friendships...');
        for (const user of users) {
          const numFriends = faker.number.int({ min: 5, max: 10 });
          const potentialFriends = users.filter((u) => u.id !== user.id);
          const shuffledFriends = potentialFriends.sort(() => 0.5 - Math.random());
          const selectedFriends = shuffledFriends.slice(0, numFriends);

          for (const friend of selectedFriends) {
            try {
              await tx.friendship.upsert({
                where: {
                  requesterId_addresseeId: {
                    requesterId: user.id,
                    addresseeId: friend.id,
                  },
                },
                update: {},
                create: {
                  requesterId: user.id,
                  addresseeId: friend.id,
                  status: 'ACCEPTED',
                },
              });
            } catch (e) {
              console.error(e);
            }
          }
        }
        console.log('✅ Created friendship connections.');

        // 6. Score Ledger
        console.log('📊 Stage 6: Generating persistent score ledger entries...');
        for (const [userId, scores] of Object.entries(userStatsMap)) {
          // 6a. Overall record
          await tx.userScore.create({
            data: {
              userId,
              periodType: PeriodType.OVERALL,
              periodStart: OVERALL_PERIOD_START,
              baseScore: scores.overall,
              totalScore: scores.overall,
            },
          });

          // 6b. Weekly records
          for (const [startStr, baseScore] of Object.entries(scores.weekly)) {
            const start = new Date(startStr);
            const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
            const isPast = end < new Date();

            // Mock a bonus and rank for past weeks
            const bonus = isPast ? faker.helpers.arrayElement([0, 0, 0, 100, 200, 500, 1000]) : 0;
            const rank = isPast && bonus > 0 ? faker.number.int({ min: 1, max: 10 }) : isPast ? faker.number.int({ min: 11, max: 50 }) : null;

            await tx.userScore.create({
              data: {
                userId,
                periodType: PeriodType.WEEKLY,
                periodStart: start,
                periodEnd: end,
                baseScore,
                bonusScore: bonus,
                totalScore: baseScore + bonus,
                rank,
              },
            });
          }

          // 6c. Monthly records
          for (const [startStr, baseScore] of Object.entries(scores.monthly)) {
            const start = new Date(startStr);
            const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
            const isPast = end < new Date();

            // Mock a bonus and rank for past months
            const bonus = isPast ? faker.helpers.arrayElement([0, 0, 0, 500, 1000, 2000, 5000]) : 0;
            const rank = isPast && bonus > 0 ? faker.number.int({ min: 1, max: 10 }) : isPast ? faker.number.int({ min: 11, max: 50 }) : null;

            await tx.userScore.create({
              data: {
                userId,
                periodType: PeriodType.MONTHLY,
                periodStart: start,
                periodEnd: end,
                baseScore,
                bonusScore: bonus,
                totalScore: baseScore + bonus,
                rank,
              },
            });
          }
        }
        console.log('✅ Generated score ledger for all users.');

        // 7. FAQs
        console.log('❓ Stage 7: Creating 15 FAQs...');
        const faqs = [
          { question: 'What is TrivioQ?', answer: 'TrivioQ is a premium trivia platform where you get scheduled "drops" of questions throughout the day based on your preferences.' },
          { question: 'How do I earn points?', answer: 'You earn points by answering questions correctly. Faster answers and harder questions give more points!' },
          { question: 'What are "Drops"?', answer: 'Drops are timed trivia questions sent to your device during your specified active window. You have a limited time to answer them.' },
          { question: 'Can I play offline?', answer: 'No, TrivioQ requires an internet connection to receive drops and sync your scores with the global leaderboard.' },
          { question: 'How does the streak work?', answer: 'Your streak increases every day you answer at least one question correctly. Missing a day resets it to zero!' },
          { question: 'What is a "Premium" account?', answer: 'Premium members get more frequent drops, exclusive categories, advanced statistics, and ad-free experience.' },
          { question: 'How do I change my active time?', answer: 'Go to Settings > Active Time. You can specify a start and end time that fits your daily schedule.' },
          { question: 'What are difficulty levels?', answer: 'Questions are categorized as Easy, Medium, or Hard. Harder questions reward significantly more points.' },
          { question: 'Can I invite friends?', answer: 'Yes! You can search for friends by username and add them to see their progress on your private leaderboard.' },
          { question: 'How are leaderboard bonuses calculated?', answer: 'Top performers in the weekly and monthly leaderboards receive bonus points at the end of each period.' },
          { question: 'What happens if I miss a drop?', answer: "Missing a drop doesn't reset your streak, but you miss out on the potential points for that question." },
          { question: 'Can I use hints?', answer: 'Yes, most questions offer a hint for a small point deduction. Use them wisely!' },
          { question: 'How do I reset my password?', answer: 'In Settings > Security, you can update your password if you signed up with an email address.' },
          { question: 'Is my data secure?', answer: 'We use industry-standard encryption and Firebase Auth to keep your account and personal information safe.' },
          { question: 'How do I contact support?', answer: 'You can reach out to our support team via email at support@trivioq.com for any assistance.' },
        ];

        await Promise.all(
          faqs.map((faq, index) =>
            tx.fAQ.create({
              data: {
                ...faq,
                order: index,
                active: true,
              },
            }),
          ),
        );
        console.log('✅ Created 15 mock FAQs.');
      },
      {
        timeout: 60000, // Increase timeout for large transaction
      },
    );

    console.log('✨ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
