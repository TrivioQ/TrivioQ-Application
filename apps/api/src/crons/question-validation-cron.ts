/**
 * Question Validation Cron
 *
 * Runs every day at 10:00 AM UTC.
 * Delegates all logic to the question-validation-service.
 */

import cron from 'node-cron';
import { runQuestionValidation } from '../services/question-validation-service';

let isRunning = false;

export function initQuestionValidationCron(): void {
  // Every day at 10:00 AM UTC  →  '0 10 * * *'
  cron.schedule('0 10 * * *', async () => {
    if (isRunning) {
      console.log('[question-validation-cron] Job is already running. Skipping this run.');
      return;
    }

    isRunning = true;
    console.log('[question-validation-cron] Validation job triggered.');
    try {
      await runQuestionValidation();
    } catch (error) {
      console.error('[question-validation-cron] Unhandled error:', error);
    } finally {
      isRunning = false;
    }
  });

  console.log('[question-validation-cron] Initialized — will run daily at 10:00 UTC.');
}
