import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const settings = [
  {
    key: 'max_drops_premium',
    value: '100',
    dataType: 'number',
    label: 'Maximum daily drops for Premium users',
  },
  {
    key: 'max_drops_free',
    value: '10',
    dataType: 'number',
    label: 'Maximum daily drops for Free users',
  },
  {
    key: 'hint_cost_percent',
    value: '30',
    dataType: 'number',
    label: 'Point deduction percentage for using a hint',
  },
  {
    key: 'support_email',
    value: 'support@trivioq.com',
    dataType: 'string',
    label: 'Public support contact email',
  },
];

async function main() {
  console.log('🌱 Seeding settings...');

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {}, // Don't overwrite if it already exists, or you can update if you want to force these values
      create: setting,
    });
    console.log(`✅ Setting upserted: ${setting.key}`);
  }

  console.log('✨ Settings seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
