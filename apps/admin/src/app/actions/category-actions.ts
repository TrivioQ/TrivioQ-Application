'use server';

import { PrismaClient } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export type CategoryFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export async function getCategories(filters: CategoryFilters = {}) {
  const { search, page = 1, pageSize = 20, sortBy = 'name', sortOrder = 'asc' } = filters;
  try {
    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [total, data] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { questions: true },
          },
        },
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
    console.error('Failed to fetch categories:', error);
    return { success: false, error: 'Failed to fetch categories' };
  }
}

export async function createCategory(data: { name: string; slug: string; description?: string }) {
  try {
    const category = await prisma.category.create({
      data,
    });
    revalidatePath('/categories');
    return { success: true, data: category };
  } catch (error) {
    console.error('Failed to create category:', error);
    return { success: false, error: 'Failed to create category. Slug must be unique.' };
  }
}

export async function updateCategory(id: string, data: { name: string; slug: string; description?: string }) {
  try {
    const category = await prisma.category.update({
      where: { id },
      data,
    });
    revalidatePath('/categories');
    return { success: true, data: category };
  } catch (error) {
    console.error('Failed to update category:', error);
    return { success: false, error: 'Failed to update category.' };
  }
}

export async function deleteCategory(id: string) {
  try {
    // Prisma implicit many-to-many relationships automatically handle disconnecting the relations.
    // The link in the underlying join table (_CategoryToQuestion) will be deleted without deleting the Question.
    await prisma.category.delete({
      where: { id },
    });
    revalidatePath('/categories');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete category:', error);
    return { success: false, error: 'Failed to delete category.' };
  }
}
