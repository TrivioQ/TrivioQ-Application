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
    value: '25',
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
  {
    key: 'ingestion_scout_provider',
    value: 'nvidia',
    dataType: 'string',
    label: 'AI Provider for Scout Phase',
  },
  {
    key: 'ingestion_scout_model',
    value: 'mistralai/mistral-small-4-119b-2603',
    dataType: 'string',
    label: 'AI Model for Scout Phase',
  },
  {
    key: 'ingestion_scout_call_delay_sec',
    value: '15',
    dataType: 'number',
    label: 'Delay between AI calls in Scout Phase (seconds)',
  },
  {
    key: 'ingestion_scout_temperature',
    value: '0.2',
    dataType: 'number',
    label: 'Temperature for Scout Phase AI',
  },
  {
    key: 'ingestion_extraction_provider',
    value: 'nvidia',
    dataType: 'string',
    label: 'AI Provider for Extraction Phase',
  },
  {
    key: 'ingestion_extraction_model',
    value: 'moonshotai/kimi-k2.6',
    dataType: 'string',
    label: 'AI Model for Extraction Phase',
  },
  {
    key: 'ingestion_extraction_call_delay_sec',
    value: '15',
    dataType: 'number',
    label: 'Delay between AI calls in Extraction Phase (seconds)',
  },
  {
    key: 'ingestion_extraction_temperature',
    value: '0.2',
    dataType: 'number',
    label: 'Temperature for Extraction Phase AI',
  },
  {
    key: 'ingestion_extraction_batch_size',
    value: '2',
    dataType: 'number',
    label: 'Batch size for Extraction Phase AI',
  },
  {
    key: 'ingestion_enhancement_provider',
    value: 'deepseek',
    dataType: 'string',
    label: 'AI Provider for Enhancement Phase',
  },
  {
    key: 'ingestion_enhancement_model',
    value: 'deepseek-v4-flash',
    dataType: 'string',
    label: 'AI Model for Enhancement Phase',
  },
  {
    key: 'ingestion_enhancement_call_delay_sec',
    value: '0',
    dataType: 'number',
    label: 'Delay between AI calls in Enhancement Phase (seconds)',
  },
  {
    key: 'ingestion_enhancement_temperature',
    value: '0.7',
    dataType: 'number',
    label: 'Temperature for Enhancement Phase AI',
  },
  {
    key: 'ingestion_enhancement_concurrency',
    value: '10',
    dataType: 'number',
    label: 'Concurrency limit for Enhancement Phase AI',
  },
  {
    key: 'ingestion_summarization_provider',
    value: 'nvidia',
    dataType: 'string',
    label: 'AI Provider for Summarization Phase',
  },
  {
    key: 'ingestion_summarization_model',
    value: 'meta/llama-3.2-90b-vision-instruct',
    dataType: 'string',
    label: 'AI Model for Summarization Phase',
  },
  {
    key: 'ingestion_summarization_call_delay_sec',
    value: '15',
    dataType: 'number',
    label: 'Delay between AI calls in Summarization Phase (seconds)',
  },
  {
    key: 'ingestion_summarization_temperature',
    value: '0.5',
    dataType: 'number',
    label: 'Temperature for Summarization Phase AI',
  },
  {
    key: 'ingestion_generation_provider',
    value: 'deepseek',
    dataType: 'string',
    label: 'AI Provider for Generation Phase',
  },
  {
    key: 'ingestion_generation_model',
    value: 'deepseek-v4-flash',
    dataType: 'string',
    label: 'AI Model for Generation Phase',
  },
  {
    key: 'ingestion_generation_call_delay_sec',
    value: '0',
    dataType: 'number',
    label: 'Delay between AI calls in Generation Phase (seconds)',
  },
  {
    key: 'ingestion_generation_temperature',
    value: '0.7',
    dataType: 'number',
    label: 'Temperature for Generation Phase AI',
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
