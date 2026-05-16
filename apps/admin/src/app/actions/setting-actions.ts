'use server';

import { prisma } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

export type SettingFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export async function getSettings(filters: SettingFilters = {}) {
  const { search, page = 1, pageSize = 20, sortBy = 'key', sortOrder = 'asc' } = filters;
  try {
    const where = {
      ...(search ? { key: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [total, data] = await Promise.all([
      prisma.setting.count({ where }),
      prisma.setting.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
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
