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
        // Deleting in order to respect foreign key constraints
        await tx.userDrop.deleteMany();
        await tx.userScore.deleteMany();
        await tx.friendship.deleteMany();
        await tx.question.deleteMany();
        await tx.category.deleteMany();
        await tx.user.deleteMany();
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
          const choices = [
            { id: faker.string.uuid(), text: faker.lorem.words(3) },
            { id: faker.string.uuid(), text: faker.lorem.words(3) },
            { id: faker.string.uuid(), text: faker.lorem.words(3) },
            { id: faker.string.uuid(), text: faker.lorem.words(3) },
          ];
          const correctAnswerId = choices[faker.number.int({ min: 0, max: 3 })].id;

          // Pick 1-3 random categories
          const shuffledCats = [...categories].sort(() => 0.5 - Math.random());
          const selectedCats = shuffledCats.slice(0, faker.number.int({ min: 1, max: 3 }));

          questionsData.push({
            questionText: faker.lorem.sentence() + '?',
            difficultyLevel: difficulties[faker.number.int({ min: 0, max: difficulties.length - 1 })],
            choices: choices,
            correctAnswerId,
            explanationText: faker.lorem.paragraph(),
            categories: {
              connect: selectedCats.map((c) => ({ id: c.id })),
            },
          });
        }

        // We can't use createMany with relations in Prisma, so we do it in a loop or chunks
        // To speed up, we'll do them in parallel with Promise.all
        const createdQuestions = await Promise.all(questionsData.map((q) => tx.question.create({ data: q })));
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
              profilePicture: faker.image.avatar(),
              currentStreak,
              subscriptionTier: tier,
              activeWindowStart,
              activeWindowEnd,
              role: Role.USER,
            },
          });
          users.push(user);
        }
        console.log('✅ Created 100 users.');

        // 4. User Drops (History)
        console.log('📥 Stage 4: Generating historical user drops (90 days)...');
        const userPointsMap: Record<string, { overall: number; weekly: Record<string, number>; monthly: Record<string, number> }> = {};

        for (const user of users) {
          userPointsMap[user.id] = { overall: 0, weekly: {}, monthly: {} };
          const numDrops = faker.number.int({ min: 50, max: 100 });

          for (let j = 0; j < numDrops; j++) {
            const isAnswered = faker.datatype.boolean();
            let wasCorrect = null;

            const scheduledDropTime = faker.date.recent({ days: 90 });
            const expirationTime = new Date(scheduledDropTime.getTime() + 15 * 60000);
            const randomQ = createdQuestions[faker.number.int({ min: 0, max: createdQuestions.length - 1 })];

            if (isAnswered) {
              const successProb = user.subscriptionTier === SubscriptionTier.PREMIUM ? 0.8 : 0.6;
              wasCorrect = Math.random() < successProb;

              if (wasCorrect) {
                const pts = DIFFICULTY_POINTS[randomQ.difficultyLevel];
                const wKey = getWeekStart(scheduledDropTime).toISOString();
                const mKey = getMonthStart(scheduledDropTime).toISOString();

                userPointsMap[user.id].overall += pts;
                userPointsMap[user.id].weekly[wKey] = (userPointsMap[user.id].weekly[wKey] || 0) + pts;
                userPointsMap[user.id].monthly[mKey] = (userPointsMap[user.id].monthly[mKey] || 0) + pts;
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
              },
            });
          }

          // Update user's cumulativeScore in the DB
          await tx.user.update({
            where: { id: user.id },
            data: { cumulativeScore: userPointsMap[user.id].overall },
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
              // Ignore unique constraint violations if friendship already exists from other side
            }
          }
        }
        console.log('✅ Created friendship connections.');

        // 6. Score Ledger
        console.log('📊 Stage 6: Generating persistent score ledger entries...');
        for (const [userId, scores] of Object.entries(userPointsMap)) {
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
