'use server';

import { prisma } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

export async function getSettings() {
  try {
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    return { success: true, data: settings };
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return { success: false, error: 'Failed to fetch settings' };
  }
}

export async function updateSetting(key: string, value: string) {
  try {
    await prisma.setting.update({ where: { key }, data: { value } });
    revalidatePath('/app-settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to update setting:', error);
    return { success: false, error: 'Failed to update setting' };
  }
}
