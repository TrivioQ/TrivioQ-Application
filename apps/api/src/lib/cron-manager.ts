import * as cron from 'node-cron';
import cronParser from 'cron-parser';
import { prisma } from '@trivioq/database';
import { pinoLogger } from '../utils/logger';
import { reportError } from '../utils/error-reporter';

export type CronJobHandler = (signal: AbortSignal) => Promise<void>;

interface RegisteredJob {
  name: string;
  expression: string;
  handler: CronJobHandler;
  task: cron.ScheduledTask | null;
  activeExecution: AbortController | null;
}

class CronManagerService {
  private jobs = new Map<string, RegisteredJob>();

  /**
   * Register a cron job. This does NOT schedule it immediately.
   * You must call `initialize()` after registering all jobs.
   */
  register(name: string, expression: string, handler: CronJobHandler) {
    if (this.jobs.has(name)) {
      throw new Error(`Cron job '${name}' is already registered.`);
    }
    this.jobs.set(name, {
      name,
      expression,
      handler,
      task: null,
      activeExecution: null,
    });
    pinoLogger.info(`[CronManager] Registered job: ${name} (${expression})`);
  }

  /**
   * Syncs registered jobs with the DB and schedules active ones.
   */
  async initialize() {
    pinoLogger.info(`[CronManager] Initializing ${this.jobs.size} jobs...`);

    // Clean up any stale RUNNING executions from previous processes that were interrupted
    try {
      const updated = await prisma.cronJobExecution.updateMany({
        where: { result: 'RUNNING' },
        data: {
          result: 'FAILED',
          endedAt: new Date(),
          errorLogs: 'Interrupted by server restart or deployment',
        },
      });
      if (updated.count > 0) {
        pinoLogger.info(`[CronManager] Cleaned up ${updated.count} stale RUNNING execution(s).`);
      }
    } catch (err) {
      reportError(err as Error, { context: '[CronManager] Error cleaning up stale executions' });
    }

    for (const [name, job] of this.jobs.entries()) {
      // Upsert to DB to ensure it exists
      let dbJob = await prisma.cronJob.findUnique({ where: { name } });
      if (!dbJob) {
        dbJob = await prisma.cronJob.create({
          data: {
            name,
            cronExpression: job.expression,
            isActive: true,
          },
        });
      } else if (dbJob.cronExpression !== job.expression) {
        // Update expression if it changed in code
        dbJob = await prisma.cronJob.update({
          where: { id: dbJob.id },
          data: { cronExpression: job.expression },
        });
      }

      if (dbJob.isActive) {
        this.startSchedule(name);
      }
      await this.updateNextRunAt(name);
    }
  }

  /**
   * Starts the node-cron scheduler for a job.
   */
  startSchedule(name: string) {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Job ${name} not found.`);

    if (job.task) {
      job.task.stop();
    }

    job.task = cron.schedule(job.expression, () => {
      this.executeJob(name).catch((err) => reportError(err as Error, { context: `[CronManager] Error executing job: ${name}` }));
    });
    pinoLogger.info(`[CronManager] Scheduled job: ${name}`);
  }

  /**
   * Stops the node-cron scheduler for a job.
   */
  stopSchedule(name: string) {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Job ${name} not found.`);
    if (job.task) {
      job.task.stop();
      job.task = null;
    }
    pinoLogger.info(`[CronManager] Stopped schedule for job: ${name}`);
  }

  /**
   * Manually trigger a job to run immediately.
   */
  async triggerJob(name: string) {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Job ${name} not found.`);
    // Do not await if we want to return API response immediately, but for consistency we might just let it run async
    this.executeJob(name).catch((err) => reportError(err as Error, { context: `[CronManager] Error executing job: ${name}` }));
  }

  /**
   * Terminates an actively running execution for a job.
   */
  async terminateExecution(name: string) {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Job ${name} not found.`);

    if (job.activeExecution) {
      job.activeExecution.abort(new Error('TERMINATED_BY_ADMIN'));
      pinoLogger.info(`[CronManager] Sent abort signal to job: ${name}`);
    } else {
      pinoLogger.info(`[CronManager] Job ${name} is not currently running.`);
    }
  }

  /**
   * Core execution wrapper.
   */
  private async executeJob(name: string) {
    const job = this.jobs.get(name);
    if (!job) return;

    if (job.activeExecution) {
      pinoLogger.info(`[CronManager] Job ${name} is already running. Skipping.`);
      return;
    }

    const dbJob = await prisma.cronJob.findUnique({ where: { name } });
    if (!dbJob) return;

    const abortController = new AbortController();
    job.activeExecution = abortController;

    const execution = await prisma.cronJobExecution.create({
      data: {
        cronJobId: dbJob.id,
        result: 'RUNNING',
      },
    });

    try {
      pinoLogger.info(`[CronManager] Executing job: ${name}`);
      await job.handler(abortController.signal);

      // Success
      await prisma.cronJobExecution.update({
        where: { id: execution.id },
        data: {
          endedAt: new Date(),
          result: 'SUCCESS',
        },
      });
      await prisma.cronJob.update({
        where: { id: dbJob.id },
        data: { lastRunAt: new Date(), lastRunResult: 'SUCCESS' },
      });
      pinoLogger.info(`[CronManager] Job ${name} completed successfully.`);
    } catch (error: any) {
      const isTerminated = error?.message === 'TERMINATED_BY_ADMIN' || abortController.signal.aborted;
      const result = isTerminated ? 'TERMINATED' : 'FAILED';

      await prisma.cronJobExecution.update({
        where: { id: execution.id },
        data: {
          endedAt: new Date(),
          result,
          errorLogs: error?.stack || error?.message || String(error),
        },
      });
      await prisma.cronJob.update({
        where: { id: dbJob.id },
        data: { lastRunAt: new Date(), lastRunResult: result },
      });
      reportError(error as Error, { context: `[CronManager] Job ${name} ${result.toLowerCase()}` });
    } finally {
      job.activeExecution = null;
      await this.updateNextRunAt(name);
    }
  }

  /**
   * Updates the nextRunAt timestamp based on the cron expression.
   */
  async updateNextRunAt(name: string) {
    const job = this.jobs.get(name);
    if (!job) return;

    try {
      const interval = cronParser.parse(job.expression, { tz: 'UTC' });
      const nextRunAt = interval.next().toDate();

      const dbJob = await prisma.cronJob.findUnique({ where: { name } });
      if (dbJob && dbJob.isActive) {
        await prisma.cronJob.update({
          where: { name },
          data: { nextRunAt },
        });
      } else if (dbJob && !dbJob.isActive) {
        await prisma.cronJob.update({
          where: { name },
          data: { nextRunAt: null },
        });
      }
    } catch (err) {
      reportError(err as Error, { context: `[CronManager] Error calculating nextRunAt for ${name}` });
    }
  }
}

export const CronManager = new CronManagerService();
