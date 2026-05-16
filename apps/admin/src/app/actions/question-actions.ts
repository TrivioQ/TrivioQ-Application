'use server';

import { PrismaClient, DifficultyLevel } from '@trivioq/database';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

const PAGE_SIZE = 20;

export type QuestionFilters = {
  search?: string;
  difficulties?: DifficultyLevel[];
  categoryIds?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type QuestionChoice = {
  id: string;
  text: string;
  order: number;
  isCorrect: boolean;
};

export type PaginatedQuestionsResult = {
  data: {
    id: string;
    questionText: string;
    difficultyLevel: DifficultyLevel;
    categories: { id: string; name: string }[];
    choices: QuestionChoice[];
    explanationText: string | null;
    hintText: string | null;
  }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getQuestions(filters: QuestionFilters = {}): Promise<PaginatedQuestionsResult> {
  const { search, difficulties, categoryIds, page = 1, pageSize = PAGE_SIZE, sortBy = 'id', sortOrder = 'desc' } = filters;

  const where = {
    ...(search ? { questionText: { contains: search, mode: 'insensitive' as const } } : {}),
    ...(difficulties && difficulties.length > 0 ? { difficultyLevel: { in: difficulties } } : {}),
    ...(categoryIds && categoryIds.length > 0 ? { categories: { some: { id: { in: categoryIds } } } } : {}),
  };

  const skip = (page - 1) * pageSize;

  const [total, data] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: {
        categories: { select: { id: true, name: true } },
        choices: { orderBy: { order: 'asc' } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type QuestionCategoryFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export async function getCategories(filters: QuestionCategoryFilters = {}) {
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

export async function createQuestion(data: { questionText: string; difficultyLevel: DifficultyLevel; choices: { text: string; isCorrect: boolean }[]; categoryIds: string[]; explanationText?: string; hintText?: string }) {
  try {
    const question = await prisma.question.create({
      data: {
        questionText: data.questionText,
        difficultyLevel: data.difficultyLevel,
        explanationText: data.explanationText,
        hintText: data.hintText,
        choices: {
          create: data.choices.map((c, idx) => ({
            text: c.text,
            order: idx,
            isCorrect: c.isCorrect,
          })),
        },
        categories: {
          connect: data.categoryIds.map((id) => ({ id })),
        },
      },
    });

    revalidatePath('/questions');
    return { success: true, data: question };
  } catch (error) {
    console.error('Failed to create question:', error);
    return { success: false, error: 'Failed to create question' };
  }
}

export async function updateQuestion(
  id: string,
  data: {
    questionText: string;
    difficultyLevel: DifficultyLevel;
    choices: { text: string; isCorrect: boolean }[];
    categoryIds: string[];
    explanationText?: string;
    hintText?: string;
  },
) {
  try {
    const existing = await prisma.question.findUnique({
      where: { id },
      include: { categories: { select: { id: true } } },
    });
    if (!existing) return { success: false, error: 'Question not found.' };

    const existingIds = existing.categories.map((c) => c.id);
    const toConnect = data.categoryIds.filter((cid) => !existingIds.includes(cid));
    const toDisconnect = existingIds.filter((cid) => !data.categoryIds.includes(cid));

    await prisma.question.update({
      where: { id },
      data: {
        questionText: data.questionText,
        difficultyLevel: data.difficultyLevel,
        explanationText: data.explanationText,
        hintText: data.hintText,
        // Delete all existing choices and recreate — simplest safe update strategy
        choices: {
          deleteMany: {},
          create: data.choices.map((c, idx) => ({
            text: c.text,
            order: idx,
            isCorrect: c.isCorrect,
          })),
        },
        categories: {
          connect: toConnect.map((cid) => ({ id: cid })),
          disconnect: toDisconnect.map((cid) => ({ id: cid })),
        },
      },
    });

    revalidatePath('/questions');
    return { success: true };
  } catch (error) {
    console.error('Failed to update question:', error);
    return { success: false, error: 'Failed to update question.' };
  }
}

export async function deleteQuestion(id: string) {
  try {
    await prisma.question.delete({ where: { id } });
    revalidatePath('/questions');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete question:', error);
    return { success: false, error: 'Failed to delete question.' };
  }
}
