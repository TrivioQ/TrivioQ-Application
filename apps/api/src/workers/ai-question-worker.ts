import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma, DifficultyLevel } from '@trivioq/database';
import type { SuggestedChoice } from '@trivioq/shared-types';
import { shuffleArray } from '../utils/shuffle';

const QUEUE_NAME = 'ai-question-generation';

const DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD'];

// ── Types ────────────────────────────────────────────────────────────────────────

export interface AiQuestionJobPayload {
  topic: string;
  categorySlug: string;
}

interface LLMQuestion {
  questionText: string;
  choices: SuggestedChoice[];
  hint: string;
  explanation: string;
}

// ── Redis / Queue ────────────────────────────────────────────────────────────────

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

export const aiQuestionQueue = new Queue<AiQuestionJobPayload>(QUEUE_NAME, {
  connection,
});

// ── Placeholder LLM call ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert trivia writer. Generate exactly 10 [INSERT_DIFFICULTY] trivia questions about [INSERT_TOPIC].

You MUST return the response strictly as a JSON array of objects. Do not include markdown formatting, conversational text, or introductions.

Each object in the array must match this exact schema:
{
"difficulty": "[INSERT_DIFFICULTY]",
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

function buildSystemPrompt(topic: string, difficulty: DifficultyLevel): string {
  return SYSTEM_PROMPT.replaceAll('[INSERT_DIFFICULTY]', difficulty).replaceAll('[INSERT_TOPIC]', topic);
}

async function generateTriviaQuestions(topic: string, categorySlug: string, difficulty: DifficultyLevel): Promise<LLMQuestion[]> {
  const systemPrompt = buildSystemPrompt(topic, difficulty);

  console.log(`[AIQuestionWorker] Generating 10 ${difficulty} questions for topic="${topic}" category="${categorySlug}"`);
  console.log(`[AIQuestionWorker] System prompt (first 120 chars): ${systemPrompt.slice(0, 120)}...`);

  // TODO: Replace with actual OpenAI / Vertex AI API call using systemPrompt
  // const response = await openai.chat.completions.create({
  //   model: 'gpt-4o',
  //   messages: [
  //     { role: 'system', content: systemPrompt },
  //     { role: 'user', content: `Topic: ${topic}, Category: ${categorySlug}` },
  //   ],
  //   response_format: { type: 'json_object' },
  // });
  // return JSON.parse(response.choices[0].message.content);

  // Simulate LLM latency
  await new Promise((resolve) => setTimeout(resolve, 300));

  return Array.from({ length: 10 }, (_, i) => ({
    questionText: `[${difficulty}] What is a notable fact about ${topic}? (Q${i + 1})`,
    choices: [
      { text: `Option A for ${topic}`, order: 0, isCorrect: true },
      { text: `Option B for ${topic}`, order: 1, isCorrect: false },
      { text: `Option C for ${topic}`, order: 2, isCorrect: false },
      { text: `Option D for ${topic}`, order: 3, isCorrect: false },
    ],
    hint: `Think about the defining characteristics of ${topic}.`,
    explanation: `${topic} is known for this notable fact, which distinguishes it from related concepts in ${categorySlug}.`,
  }));
}

// ── Job handler ──────────────────────────────────────────────────────────────────

async function handleAiQuestionGeneration(job: Job<AiQuestionJobPayload>): Promise<void> {
  const { topic, categorySlug } = job.data;

  console.log(`[AIQuestionWorker] Processing job ${job.id} — topic="${topic}" category="${categorySlug}"`);

  // 1. Three parallel LLM calls — one per difficulty, 10 questions each
  let results: { difficulty: DifficultyLevel; questions: LLMQuestion[] }[];
  try {
    results = await Promise.all(
      DIFFICULTIES.map(async (difficulty) => {
        const questions = await generateTriviaQuestions(topic, categorySlug, difficulty);
        return { difficulty, questions };
      }),
    );
  } catch (error) {
    console.error(`[AIQuestionWorker] LLM generation failed for topic="${topic}":`, error);
    throw error;
  }

  // 2. Flatten into 30 questions, shuffle each question's choices
  const rows = results.flatMap(({ difficulty, questions }) =>
    questions.map((q) => ({
      topic,
      categorySlug,
      difficultyLevel: difficulty,
      suggestedText: q.questionText,
      suggestedChoices: shuffleArray(q.choices) as any,
      hint: q.hint,
      explanation: q.explanation,
      status: 'PENDING' as const,
    })),
  );

  // 3. Batch insert all 30 into PendingQuestion
  try {
    await prisma.pendingQuestion.createMany({ data: rows });

    console.log(`[AIQuestionWorker] Batch-inserted ${rows.length} PendingQuestions for topic="${topic}"`);
  } catch (error) {
    console.error(`[AIQuestionWorker] createMany failed for topic="${topic}":`, error);
    throw error;
  }
}

// ── Worker ───────────────────────────────────────────────────────────────────────

const aiQuestionWorker = new Worker<AiQuestionJobPayload>(QUEUE_NAME, handleAiQuestionGeneration, { connection, concurrency: 3 });

aiQuestionWorker.on('completed', (job) => {
  console.log(`[AIQuestionWorker] Job ${job.id} completed`);
});

aiQuestionWorker.on('failed', (job, err) => {
  console.error(`[AIQuestionWorker] Job ${job?.id} failed:`, err);
});

// ── Init ─────────────────────────────────────────────────────────────────────────

export function initAIQuestionWorker(): void {
  console.log('[AIQuestionWorker] Initialized — listening on ai-question-generation queue');
}
