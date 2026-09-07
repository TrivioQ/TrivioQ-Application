import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating category slug...');

  const result = await prisma.category.updateMany({
    where: { slug: 'indian-culture' },
    data: { slug: 'indian-art-culture' },
  });

  console.log('Update result for categories:', result);

  // Update PendingQuestion categorySlugs since they are stored as strings
  const pendingQuestions = await prisma.pendingQuestion.findMany({
    where: { categorySlugs: { has: 'indian-culture' } },
  });

  console.log(`Found ${pendingQuestions.length} pending questions with 'indian-culture'. Updating them...`);

  let pendingUpdateCount = 0;
  for (const pq of pendingQuestions) {
    const updatedSlugs = pq.categorySlugs.map((slug) => (slug === 'indian-culture' ? 'indian-art-culture' : slug));
    await prisma.pendingQuestion.update({
      where: { id: pq.id },
      data: { categorySlugs: updatedSlugs },
    });
    pendingUpdateCount++;
  }

  console.log(`Updated ${pendingUpdateCount} pending questions.`);
}

main()
  .catch((e) => {
    console.error('❌ Failed to update category slug:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
