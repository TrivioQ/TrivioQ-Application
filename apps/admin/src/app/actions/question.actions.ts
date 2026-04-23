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
};

export type PaginatedQuestionsResult = {
  data: {
    id: string;
    questionText: string;
    difficultyLevel: DifficultyLevel;
    categories: { id: string; name: string }[];
  }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getQuestions(
  filters: QuestionFilters = {}
): Promise<PaginatedQuestionsResult> {
  const {
    search,
    difficulties,
    categoryIds,
    page = 1,
    pageSize = PAGE_SIZE,
  } = filters;

  const where = {
    ...(search
      ? { questionText: { contains: search, mode: 'insensitive' as const } }
      : {}),
    ...(difficulties && difficulties.length > 0
      ? { difficultyLevel: { in: difficulties } }
      : {}),
    ...(categoryIds && categoryIds.length > 0
      ? { categories: { some: { id: { in: categoryIds } } } }
      : {}),
  };

  const skip = (page - 1) * pageSize;

  const [total, data] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { categories: { select: { id: true, name: true } } },
      orderBy: { id: 'desc' },
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

export async function getCategories() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return { success: true, data: categories };
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return { success: false, error: 'Failed to fetch categories' };
  }
}

export async function createQuestion(data: {
  questionText: string;
  difficultyLevel: DifficultyLevel;
  choices: { id: string; text: string }[];
  correctAnswerId: string;
  categoryIds: string[];
}) {
  try {
    const question = await prisma.question.create({
      data: {
        questionText: data.questionText,
        difficultyLevel: data.difficultyLevel,
        choices: data.choices,
        correctAnswerId: data.correctAnswerId,
        categories: {
          connect: data.categoryIds.map(id => ({ id })),
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
