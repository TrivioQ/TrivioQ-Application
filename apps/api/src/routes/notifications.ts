import express, { Request, Response } from 'express';
import { requireSession } from '../middleware/firebase-auth';
import { requireAdmin } from '../middleware/require-admin';
import { notificationService } from '../services/notification-service';
import { NotificationType, NotificationAudience, NotificationChannel } from '@prisma/client';

const router = express.Router();

// ============================================================================
// ADMIN ROUTES - /api/v1/admin/notifications
// ============================================================================

/**
 * GET /api/v1/admin/notifications
 * List all notifications with pagination
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', status, type } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      (global as any).prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          template: true,
          _count: {
            select: { userNotifications: true },
          },
        },
      }),
      (global as any).prisma.notification.count({ where }),
    ]);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error('Error listing notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/notifications/templates
 * List all notification templates
 */
router.get('/templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const templates = await (global as any).prisma.notificationTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ templates });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/notifications
 * Create a new notification
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, audience, title, body, data, channels, targetUserIds, targetCriteria, scheduledAt } = req.body;

    if (!type || !audience || !title || !body || !channels) {
      return res.status(400).json({
        error: 'Missing required fields: type, audience, title, body, channels',
      });
    }

    const notification = await notificationService.create({
      type: type as NotificationType,
      audience: audience as NotificationAudience,
      title,
      body,
      data,
      channels: channels as NotificationChannel[],
      targetUserIds,
      targetCriteria,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      createdBy: (req as any).user?.email,
    });

    res.status(201).json({ notification });
  } catch (error: any) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/notifications/from-template
 * Create a notification from template
 */
router.post('/from-template', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { templateId, audience, variables, data, channels, targetUserIds, targetCriteria, scheduledAt } = req.body;

    if (!templateId || !audience || !variables) {
      return res.status(400).json({
        error: 'Missing required fields: templateId, audience, variables',
      });
    }

    const notification = await notificationService.createFromTemplate({
      templateId,
      audience: audience as NotificationAudience,
      variables,
      data,
      channels: channels as NotificationChannel[] | undefined,
      targetUserIds,
      targetCriteria,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      createdBy: (req as any).user?.email,
    });

    res.status(201).json({ notification });
  } catch (error: any) {
    console.error('Error creating notification from template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/notifications/:id/send
 * Trigger delivery of a notification
 */
router.post('/:id/send', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await notificationService.send(id);
    res.json({ message: 'Notification delivery triggered', notificationId: id });
  } catch (error: any) {
    console.error('Error triggering delivery:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/notifications/:id
 * Get notification details
 */
router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const notification = await (global as any).prisma.notification.findUnique({
      where: { id: req.params.id },
      include: {
        template: true,
        userNotifications: {
          take: 100,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error: any) {
    console.error('Error getting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/admin/notifications/:id/analytics
 * Get notification analytics
 */
router.get('/:id/analytics', requireAdmin, async (req: Request, res: Response) => {
  try {
    const analytics = await notificationService.getAnalytics(req.params.id);
    res.json({ analytics });
  } catch (error: any) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/admin/notifications/:id
 * Update a notification
 */
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, body, data, scheduledAt } = req.body;

    const notification = await (global as any).prisma.notification.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(body && { body }),
        ...(data && { data: data as any }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      },
    });

    res.json({ notification });
  } catch (error: any) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/admin/notifications/:id
 * Delete a notification
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await (global as any).prisma.notification.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/admin/notifications/templates
 * Create a new template
 */
router.post('/templates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, type, title, body, emailSubject, emailHtml, channels, variables } = req.body;

    if (!name || !type || !title || !body || !channels || !variables) {
      return res.status(400).json({
        error: 'Missing required fields: name, type, title, body, channels, variables',
      });
    }

    const template = await (global as any).prisma.notificationTemplate.create({
      data: {
        name,
        type: type as NotificationType,
        title,
        body,
        emailSubject,
        emailHtml,
        channels: channels as NotificationChannel[],
        variables,
      },
    });

    res.status(201).json({ template });
  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/admin/notifications/templates/:id
 * Update a template
 */
router.put('/templates/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, body, emailSubject, emailHtml, variables, isActive } = req.body;

    const template = await (global as any).prisma.notificationTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(body && { body }),
        ...(emailSubject && { emailSubject }),
        ...(emailHtml && { emailHtml }),
        ...(variables && { variables: variables as string[] }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ template });
  } catch (error: any) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// USER ROUTES - /api/v1/notifications
// ============================================================================

/**
 * GET /api/v1/notifications/inbox
 * Get user's notification inbox
 */
router.get('/inbox', requireSession, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const result = await notificationService.getInbox((req as any).userId, parseInt(limit as string), parseInt(offset as string));
    res.json(result);
  } catch (error: any) {
    console.error('Error getting inbox:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/notifications/:id/read
 * Mark a notification as read
 */
router.post('/:id/read', requireSession, async (req: Request, res: Response) => {
  try {
    // Verify the notification belongs to the user
    const userNotification = await (global as any).prisma.userNotification.findFirst({
      where: {
        id: req.params.id,
        userId: (req as any).userId,
      },
    });

    if (!userNotification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notificationService.markAsRead(req.params.id);
    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', requireSession, async (req: Request, res: Response) => {
  try {
    await notificationService.markAllAsRead((req as any).userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', requireSession, async (req: Request, res: Response) => {
  try {
    const preferences = await notificationService.getPreferences((req as any).userId);
    res.json({ preferences });
  } catch (error: any) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/notifications/preferences
 * Update user's notification preferences
 */
router.put('/preferences', requireSession, async (req: Request, res: Response) => {
  try {
    const preferences = await notificationService.updatePreferences((req as any).userId, req.body);
    res.json({ preferences });
  } catch (error: any) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/notifications/webpush/subscribe
 * Subscribe to web push notifications
 */
router.post('/webpush/subscribe', requireSession, async (req: Request, res: Response) => {
  try {
    const { endpoint, p256dh, auth, browser } = req.body;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({
        error: 'Missing required fields: endpoint, p256dh, auth',
      });
    }

    const subscription = await notificationService.subscribeWebPush((req as any).userId, {
      endpoint,
      p256dh,
      auth,
      browser,
    });

    res.json({ subscription });
  } catch (error: any) {
    console.error('Error subscribing to web push:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/notifications/webpush/subscribe
 * Unsubscribe from web push notifications
 */
router.delete('/webpush/subscribe', requireSession, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing required field: endpoint' });
    }

    await notificationService.unsubscribeWebPush((req as any).userId, endpoint);
    res.json({ message: 'Unsubscribed from web push' });
  } catch (error: any) {
    console.error('Error unsubscribing from web push:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/notifications/webpush/public-key
 * Get VAPID public key for web push subscription
 */
router.get('/webpush/public-key', async (req: Request, res: Response) => {
  try {
    const { webPushService } = await import('../services/webpush-service');
    const publicKey = webPushService.getVapidPublicKey();

    if (!publicKey) {
      return res.status(500).json({ error: 'VAPID public key not configured' });
    }

    res.json({ publicKey });
  } catch (error: any) {
    console.error('Error getting VAPID public key:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
