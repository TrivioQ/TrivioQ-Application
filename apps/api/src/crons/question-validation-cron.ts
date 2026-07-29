/**
 * Question Validation Cron
 *
 * Runs every day at 10:00 AM UTC.
 * Delegates all logic to the question-validation-service.
 */

import { CronManager } from '../lib/cron-manager';
import { runQuestionValidation } from '../services/question-validation-service';

export function initQuestionValidationCron(): void {
  // Every day at 10:00 AM UTC  →  '0 10 * * *'
  CronManager.register('AI Question Validation', '0 10 * * *', async (signal) => {
    console.log('[question-validation-cron] Validation job triggered.');
    await runQuestionValidation(signal);
  });
}
