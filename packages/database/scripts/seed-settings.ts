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
  {
    key: 'drop_expiry_minutes',
    value: '30',
    dataType: 'number',
    label: 'Minutes a dropped question stays available before it expires',
  },
  {
    key: 'answer_timer_easy_seconds',
    value: '60',
    dataType: 'number',
    label: 'Seconds to answer an Easy question after revealing it',
  },
  {
    key: 'answer_timer_medium_seconds',
    value: '180',
    dataType: 'number',
    label: 'Seconds to answer a Medium question after revealing it',
  },
  {
    key: 'answer_timer_hard_seconds',
    value: '300',
    dataType: 'number',
    label: 'Seconds to answer a Hard question after revealing it',
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
