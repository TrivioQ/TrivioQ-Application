/**
 * Question Validation Cron
 *
 * Runs every day at 9:00 PM UTC.
 * Delegates all logic to the question-validation-service.
 */

import cron from 'node-cron';
import { runQuestionValidation } from '../services/question-validation-service';

export function initQuestionValidationCron(): void {
  // Every day at 9:00 PM UTC  →  '0 21 * * *'
  cron.schedule('0 21 * * *', async () => {
    console.log('[question-validation-cron] Nightly validation job triggered.');
    try {
      await runQuestionValidation();
    } catch (error) {
      console.error('[question-validation-cron] Unhandled error:', error);
    }
  });

  console.log('[question-validation-cron] Initialized — will run daily at 21:00 UTC.');
}
