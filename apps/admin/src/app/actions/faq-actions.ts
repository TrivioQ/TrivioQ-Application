'use server';

import { prisma } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

export async function getFAQs() {
  try {
    const faqs = await prisma.fAQ.findMany({
      orderBy: {
        order: 'asc',
      },
    });
    return { success: true, data: faqs };
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
