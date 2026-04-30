'use server';

import { prisma } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

export type FAQFilters = {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export async function getFAQs(filters: FAQFilters = {}) {
  const { search, active, page = 1, pageSize = 20, sortBy = 'order', sortOrder = 'asc' } = filters;
  try {
    const where = {
      ...(search ? { question: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(active !== undefined ? { active } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [total, data] = await Promise.all([
      prisma.fAQ.count({ where }),
      prisma.fAQ.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      })
    ]);

    return { 
      success: true, 
      data, 
      total, 
      page, 
      pageSize, 
      totalPages: Math.max(1, Math.ceil(total / pageSize)) 
    };
  } catch (error) {
    console.error('Failed to fetch FAQs:', error);
    return { success: false, error: 'Failed to fetch FAQs' };
  }
}

export async function createFAQ(data: { question: string; answer: string; order?: number; active?: boolean }) {
  try {
    const faq = await prisma.fAQ.create({
      data: {
        ...data,
        order: data.order ?? 0,
        active: data.active ?? true,
      },
    });
    revalidatePath('/faqs');
    return { success: true, data: faq };
  } catch (error) {
    console.error('Failed to create FAQ:', error);
    return { success: false, error: 'Failed to create FAQ' };
  }
}

export async function updateFAQ(id: string, data: { question?: string; answer?: string; order?: number; active?: boolean }) {
  try {
    const faq = await prisma.fAQ.update({
      where: { id },
      data,
    });
    revalidatePath('/faqs');
    return { success: true, data: faq };
  } catch (error) {
    console.error('Failed to update FAQ:', error);
    return { success: false, error: 'Failed to update FAQ' };
  }
}

export async function deleteFAQ(id: string) {
  try {
    await prisma.fAQ.delete({
      where: { id },
    });
    revalidatePath('/faqs');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete FAQ:', error);
    return { success: false, error: 'Failed to delete FAQ' };
  }
}
