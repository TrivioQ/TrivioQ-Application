import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const INGESTION_DIR = process.env.INGESTION_DIR ?? path.join(__dirname, 'ingestion');

async function main() {
  console.log('Scanning for ingestion jobs to recover skipped pages...');

  const jobs = await prisma.ingestionJob.findMany({
    where: {
      status: { in: ['COMPLETED', 'FAILED', 'PAUSED'] },
    },
  });

  let recoveredCount = 0;

  for (const job of jobs) {
    const stateFile = path.join(INGESTION_DIR, job.id, 'data', 'state.json');
    if (!fs.existsSync(stateFile)) continue;

    try {
      const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

      // Reset the tracking indices so the worker scans from the beginning
      let modified = false;
      if (stateData.lastProcessedExtractionBatchIndex > -1 || stateData.lastProcessedImageIndex > -1) {
        stateData.lastProcessedExtractionBatchIndex = -1;
        stateData.lastProcessedImageIndex = -1;
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2));

        // Mark job as QUEUED so the worker picks it up
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: { status: 'QUEUED' },
        });

        console.log(`✅ Queued job ${job.id} for recovery scan.`);
        recoveredCount++;
      }
    } catch (e) {
      console.error(`❌ Failed to process state for job ${job.id}:`, e);
    }
  }

  console.log(`\nRecovery queuing complete! Queued ${recoveredCount} jobs.`);
  console.log('The ingestion worker will now scan these jobs from page 1.');
  console.log('Thanks to the idempotency updates, it will INSTANTLY skip pages that were already processed successfully, and only send the skipped pages to the AI.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
