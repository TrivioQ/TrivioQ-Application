import { PrismaClient, DifficultyLevel, SubscriptionTier, Role } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting mock data seeding...');

  try {
    await prisma.$transaction(
      async (tx) => {
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
        console.log('📥 Stage 4: Generating historical user drops...');
        for (const user of users) {
          const numDrops = faker.number.int({ min: 10, max: 20 });
          for (let j = 0; j < numDrops; j++) {
            const isAnswered = faker.datatype.boolean();
            let wasCorrect = null;

            if (isAnswered) {
              const streak = user.currentStreak;
              const successProb = streak > 10 ? 0.9 : streak > 5 ? 0.7 : 0.5;
              wasCorrect = Math.random() < successProb;
            }

            const scheduledDropTime = faker.date.recent({ days: 14 });
            const expirationTime = new Date(scheduledDropTime.getTime() + 15 * 60000);

            // Pick a random question
            const randomQ = createdQuestions[faker.number.int({ min: 0, max: createdQuestions.length - 1 })];

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
        }
        console.log('✅ Generated historical drops for all users.');

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
