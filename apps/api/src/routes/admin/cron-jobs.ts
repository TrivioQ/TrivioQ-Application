import { Router } from 'express';
import { prisma } from '@trivioq/database';
import { CronManager } from '../../lib/cron-manager';

export const cronJobsRouter = Router();

// GET /api/admin/cron-jobs
// Fetch all cron jobs with their latest execution status
cronJobsRouter.get('/', async (req, res) => {
  try {
    const jobs = await prisma.cronJob.findMany({
      orderBy: { name: 'asc' },
      include: {
        executions: {
          where: { endedAt: null, result: 'RUNNING' },
          take: 1,
        },
      },
    });

    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      schedule: job.cronExpression,
      isActive: job.isActive,
      isExecuting: job.executions.length > 0,
      nextRunAt: job.nextRunAt,
      lastRunAt: job.lastRunAt,
      lastRunResult: job.lastRunResult,
    }));

    return res.json(formattedJobs);
  } catch (error) {
    console.error('Error fetching cron jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch cron jobs' });
  }
});

// GET /api/admin/cron-jobs/:id/executions
// Fetch execution history for a specific job
cronJobsRouter.get('/:id/executions', async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const skip = (page - 1) * limit;

    const [executions, totalCount] = await Promise.all([
      prisma.cronJobExecution.findMany({
        where: { cronJobId: id },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.cronJobExecution.count({ where: { cronJobId: id } }),
    ]);

    return res.json({
      executions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching cron job executions:', error);
    return res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// POST /api/admin/cron-jobs/:id/toggle
// Activate or deactivate the cron job schedule
cronJobsRouter.post('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.cronJob.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const newStatus = !job.isActive;
    await prisma.cronJob.update({
      where: { id },
      data: { isActive: newStatus },
    });

    if (newStatus) {
      CronManager.startSchedule(job.name);
    } else {
      CronManager.stopSchedule(job.name);
    }

    // updateNextRunAt handles writing back to db
    await CronManager.updateNextRunAt(job.name);

    return res.json({ success: true, isActive: newStatus });
  } catch (error) {
    console.error('Error toggling cron job:', error);
    return res.status(500).json({ error: 'Failed to toggle cron job' });
  }
});

// POST /api/admin/cron-jobs/:id/trigger
// Manually run a job immediately
cronJobsRouter.post('/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.cronJob.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Fire and forget (don't block the request)
    CronManager.triggerJob(job.name);

    return res.json({ success: true, message: 'Job triggered successfully' });
  } catch (error) {
    console.error('Error triggering cron job:', error);
    return res.status(500).json({ error: 'Failed to trigger cron job' });
  }
});

// POST /api/admin/cron-jobs/:id/terminate
// Manually abort an active execution
cronJobsRouter.post('/:id/terminate', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await prisma.cronJob.findUnique({ where: { id } });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await CronManager.terminateExecution(job.name);

    return res.json({ success: true, message: 'Termination signal sent' });
  } catch (error) {
    console.error('Error terminating cron job:', error);
    return res.status(500).json({ error: 'Failed to terminate cron job' });
  }
});
