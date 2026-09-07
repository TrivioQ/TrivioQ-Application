import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up invalid category slugs from PendingQuestions...');

  const categories = await prisma.category.findMany({ select: { slug: true } });
  const validSlugs = new Set(categories.map((c) => c.slug));

  const allPendingQuestions = await prisma.pendingQuestion.findMany({
    select: { id: true, categorySlugs: true },
  });

  let cleanupCount = 0;

  for (const pq of allPendingQuestions) {
    // Keep only valid slugs
    const validCategorySlugs = pq.categorySlugs.filter((slug) => validSlugs.has(slug));

    // Only update if there was actually an invalid slug removed
    if (validCategorySlugs.length !== pq.categorySlugs.length) {
      await prisma.pendingQuestion.update({
        where: { id: pq.id },
        data: { categorySlugs: validCategorySlugs },
      });
      cleanupCount++;
    }
  }

  console.log(`Successfully cleaned up invalid category slugs from ${cleanupCount} pending questions.`);
}

main()
  .catch((e) => {
    console.error('❌ Failed to clean up category slugs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
