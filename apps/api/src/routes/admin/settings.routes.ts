import { Router, Request, Response } from 'express';
import { prisma } from '@trivioq/database';

const router = Router();

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get all configuration settings
 * @access  Private (Admin Only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update or create multiple configuration settings
 * @access  Private (Admin Only)
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings array is required' });
    }

    const updatedSettings = [];

    // We can use a transaction to upsert all settings
    for (const setting of settings) {
      if (!setting.key) continue;

      const updated = await prisma.setting.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          label: setting.label,
        },
        create: {
          key: setting.key,
          value: setting.value,
          label: setting.label,
        },
      });
      updatedSettings.push(updated);
    }

    return res.status(200).json({ success: true, data: updatedSettings });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const settingsRouter = router;
