import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma, DifficultyLevel } from '@trivioq/database';
import type { SuggestedChoice } from '@trivioq/shared-types';
import { shuffleArray } from '../utils/shuffle';
import { checkIsDuplicate } from '../utils/check-is-duplicate';
import { reportError } from '../utils/error-reporter';
import { GoogleGenAI } from '@google/genai';

const QUEUE_NAME = 'ai-question-generation';

const DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD'];

// ── Types ────────────────────────────────────────────────────────────────────────

export interface AiQuestionJobPayload {
  topic?: string;
}

interface LLMQuestion {
  questionText: string;
  topic: string;
  categorySlugs: string[];
  choices: SuggestedChoice[];
  hint: string;
  explanation: string;
}

interface AIReviewResult {
  aiQualityScore: number;
  aiFeedback: string;
}

// ── Redis / Queue ────────────────────────────────────────────────────────────────

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

export const aiQuestionQueue = new Queue<AiQuestionJobPayload>(QUEUE_NAME, {
  connection: connection as any,
});

// Initialize Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Gemini AI / Prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert trivia writer. Generate exactly 10 [INSERT_DIFFICULTY] trivia questions about [INSERT_TOPIC].

You MUST return the response strictly as a JSON array of objects. Do not include markdown formatting, conversational text, or introductions.

Each object in the array must match this exact schema:
{
"difficulty": "[INSERT_DIFFICULTY]",
"topic": "A concise string defining the specific topic",
"categorySlugs": ["slug1", "slug2"],
"questionText": "The trivia question here",
"hint": "A short, helpful clue",
"explanation": "A 1-2 sentence explanation of why the correct answer is true",
"choices": [
{ "text": "Correct Option", "isCorrect": true },
{ "text": "Incorrect Option B", "isCorrect": false },
{ "text": "Incorrect Option C", "isCorrect": false },
{ "text": "Incorrect Option D", "isCorrect": false }
]
}
Ensure the distractor choices (the incorrect ones) are plausible and appropriately scaled for the requested difficulty level.`;

function buildSystemPrompt(topic: string | undefined, categories: { slug: string; name: string }[], difficulty: DifficultyLevel): string {
  const categoryListStr = categories.map((c) => `- "${c.slug}" (${c.name})`).join('\n');
  let prompt = SYSTEM_PROMPT.replaceAll('[INSERT_DIFFICULTY]', difficulty);
  if (topic) {
    prompt = prompt.replaceAll('[INSERT_TOPIC]', topic);
  } else {
    prompt = prompt.replaceAll('[INSERT_TOPIC]', 'any general knowledge topic');
  }

  return prompt + `\n\nChoose 1-2 categorySlugs from this list:\n${categoryListStr}`;
}

async function generateTriviaQuestions(topic: string | undefined, categories: { slug: string; name: string }[], difficulty: DifficultyLevel): Promise<LLMQuestion[]> {
  const systemPrompt = buildSystemPrompt(topic, categories, difficulty);

  console.log(`[AIQuestionWorker] Generating 10 ${difficulty} questions for topic="${topic || 'auto'}"`);
  console.log(`[AIQuestionWorker] System prompt (first 120 chars): ${systemPrompt.slice(0, 120)}...`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `Generate questions. ${topic ? `Topic: ${topic}` : ''}`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    },
  });

  if (!response.text) {
    throw new Error('Gemini API did not return text content for question generation.');
  }

  return JSON.parse(response.text);
}

const QUALITY_REVIEW_SYSTEM_PROMPT = `You are a trivia quality reviewer. Evaluate the following list of trivia questions for difficulty accuracy, distractor plausibility, and overall quality.

Return a JSON array of objects with exactly one entry per question, in the same order. Each object must match this schema:
{
  "aiQualityScore": <integer 0-100>,
  "aiFeedback": "<concise feedback explaining the score>"
}`;

async function reviewQuestionsForQuality(questions: { suggestedText: string; difficultyLevel: DifficultyLevel; suggestedChoices: any; hint: string; explanation: string }[], topic: string | undefined): Promise<AIReviewResult[]> {
  console.log(`[AIQuestionWorker] Requesting quality review for ${questions.length} questions on topic="${topic}"`);
  console.log(`[AIQuestionWorker] Quality review system prompt (first 120 chars): ${QUALITY_REVIEW_SYSTEM_PROMPT.slice(0, 120)}...`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: JSON.stringify(questions),
    config: {
      systemInstruction: QUALITY_REVIEW_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  if (!response.text) {
    throw new Error('Gemini API did not return text content for quality review.');
  }

  return JSON.parse(response.text);
}

// ── Job handler ──────────────────────────────────────────────────────────────────

async function handleAiQuestionGeneration(job: Job<AiQuestionJobPayload>): Promise<void> {
  const { topic } = job.data;

  console.log(`[AIQuestionWorker] Processing job ${job.id} — topic="${topic || 'auto'}"`);

  // 0. Fetch all categories from the database
  const categories = await prisma.category.findMany({ select: { slug: true, name: true } });

  // 1. Three parallel LLM calls — one per difficulty, 10 questions each
  let results: { difficulty: DifficultyLevel; questions: LLMQuestion[] }[];
  try {
    results = await Promise.all(
      DIFFICULTIES.map(async (difficulty) => {
        const questions = await generateTriviaQuestions(topic, categories, difficulty);
        return { difficulty, questions };
      }),
    );
  } catch (error) {
    reportError(error instanceof Error ? error : new Error(String(error)), { topic, phase: 'llm-generation' });
    throw error;
  }

  // 2. Flatten into 30 questions, shuffle each question's choices
  const rows = results.flatMap(({ difficulty, questions }) =>
    questions.map((q) => ({
      topic: q.topic || topic || 'General',
      categorySlugs: q.categorySlugs,
      difficultyLevel: difficulty,
      suggestedText: q.questionText,
      suggestedChoices: shuffleArray(q.choices) as any,
      hint: q.hint,
      explanation: q.explanation,
      status: 'PENDING' as const,
      isDuplicate: false,
      isValidated: false,
      aiQualityScore: undefined as number | undefined,
      aiFeedback: undefined as string | undefined,
    })),
  );

  // 3. Run duplicate checks in parallel against the Question table
  const duplicateFlags = await Promise.all(rows.map((row) => checkIsDuplicate(row.suggestedText)));

  for (let i = 0; i < rows.length; i++) {
    if (duplicateFlags[i]) {
      rows[i].isDuplicate = true;
      rows[i].isValidated = true;
    }
  }

  const duplicateCount = duplicateFlags.filter(Boolean).length;
  if (duplicateCount > 0) {
    console.log(`[AIQuestionWorker] Found ${duplicateCount} duplicate(s) out of ${rows.length} generated questions`);
  }

  // 4. Filter out duplicates for quality review
  const uniqueQuestions = rows.filter((row) => !row.isDuplicate);

  // 5. Send unique questions in a single batch for LLM quality review
  if (uniqueQuestions.length > 0) {
    let qualityReviews: AIReviewResult[];
    try {
      qualityReviews = await reviewQuestionsForQuality(uniqueQuestions, topic);
    } catch (error) {
      reportError(error instanceof Error ? error : new Error(String(error)), { topic, phase: 'quality-review' });
      throw error;
    }

    // 6. Merge quality scores and feedback back into unique questions
    for (let i = 0; i < uniqueQuestions.length; i++) {
      uniqueQuestions[i].aiQualityScore = qualityReviews[i].aiQualityScore;
      uniqueQuestions[i].aiFeedback = qualityReviews[i].aiFeedback;
    }
  }

  // 7. Mark all questions as validated and batch insert
  for (const row of rows) {
    row.isValidated = true;
  }

  try {
    await prisma.pendingQuestion.createMany({ data: rows as any });

    console.log(`[AIQuestionWorker] Batch-inserted ${rows.length} PendingQuestions for topic="${topic}" (${duplicateCount} duplicates, ${uniqueQuestions.length} reviewed)`);
  } catch (error) {
    reportError(error instanceof Error ? error : new Error(String(error)), { topic, phase: 'batch-insert' });
    throw error;
  }
}

// ── Worker ───────────────────────────────────────────────────────────────────────

const aiQuestionWorker = new Worker<AiQuestionJobPayload>(QUEUE_NAME, handleAiQuestionGeneration, { connection: connection as any, concurrency: 3 });

aiQuestionWorker.on('completed', (job) => {
  console.log(`[AIQuestionWorker] Job ${job.id} completed`);
  prisma.jobLog
    .create({
      data: {
        jobId: job.id ?? 'unknown',
        queueName: QUEUE_NAME,
        jobName: job.name,
        status: 'COMPLETED',
        payload: job.data as any,
        result: 'Job was successful.',
      },
    })
    .catch((err) => console.error('[AIQuestionWorker] Failed to log completed job:', err));
});

aiQuestionWorker.on('failed', (job, err) => {
  reportError(err, { jobId: job?.id, queueName: QUEUE_NAME, jobName: job?.name });
  prisma.jobLog
    .create({
      data: {
        jobId: job?.id ?? 'unknown',
        queueName: QUEUE_NAME,
        jobName: job?.name ?? 'unknown',
        status: 'FAILED',
        payload: (job?.data ?? {}) as any,
        result: { message: err.message, stack: err.stack },
      },
    })
    .catch((dbErr) => console.error('[AIQuestionWorker] Failed to log failed job:', dbErr));
});

// ── Init ─────────────────────────────────────────────────────────────────────────

export function initAIQuestionWorker(): void {
  console.log('[AIQuestionWorker] Initialized — listening on ai-question-generation queue');
}
