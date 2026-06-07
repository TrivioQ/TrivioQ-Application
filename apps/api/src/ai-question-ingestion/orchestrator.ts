import { GoogleGenAI } from '@google/genai';
import { prisma, DifficultyLevel } from '@trivioq/database';
import { IngestionState, Question } from './utils/stateManager';
import { checkIsDuplicate } from '../utils/checkIsDuplicate';
import { shuffleArray } from '../utils/shuffle';
import { reportError } from '../utils/errorReporter';
import fs from 'fs';

// ── AI Client ─────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// ── Types ─────────────────────────────────────

export type ImageType = 'QUESTIONS' | 'ANSWER_KEY' | 'OTHER';

export interface ImageGroup {
  questions: string[];
  answerKeys: string[];
}

export interface ExtractedQuestion {
  id: string;
  text: string;
  choices: { text: string; isCorrect: boolean }[];
  answerKeyRef?: string;
  pageNumber?: number;
}

export interface ExtractedAnswerKey {
  id: string;
  answers: Record<string, string>;
  questionRefs: string[];
  pageNumber?: number;
}

export interface EnhancedQuestion {
  id: string;
  hint: string;
  explanation: string;
  aiQualityScore: number;
}

// ── Prompts ─────────────────────────────────────

const SCOUT_PROMPT = `You are a document classifier. Analyze the provided page image and classify it into one of these categories:
- "QUESTIONS" — contains trivia or quiz questions
- "ANSWER_KEY" — contains answers or answer keys for questions
- "OTHER" — anything else (table of contents, blank pages, etc.)

Return ONLY a JSON object with this exact schema. Do not include markdown, explanations, or any other text:
{"classification": "QUESTIONS|ANSWER_KEY|OTHER", "confidence": 0.0-1.0}`;

const EXTRACTION_PROMPT = `You are an expert trivia question extractor. Given images containing trivia questions (and possibly their answer keys), extract all questions with their multiple-choice options.

## CRITICAL — Markdown compatibility rules
All "text" fields (question text and choice text) MUST be written in **GitHub-Flavored Markdown (GFM)**.
The output is rendered by TWO different engines:
  • Web/Admin — react-markdown v10 with remark-gfm, remark-math, and rehype-katex (full KaTeX support)
  • Mobile    — react-native-markdown-display v7 (markdown-it, NO math plugin installed)

Follow every rule below exactly:

### 1. Mathematical formulas
Always write math in TWO parts on the same line:
  a) LaTeX notation for the web renderer: \`$<LaTeX>$\` (inline) or \`$$<LaTeX>$$\` (block)
  b) A plain-text readable version in parentheses immediately after, for the mobile renderer.

Examples:
  • Inline:  \`The formula $E = mc^2$ (E equals m times c squared) was proposed by Einstein.\`
  • Block:
    \`\`\`
    $$\\frac{d}{dx}\\sin x = \\cos x$$
    (The derivative of sin x equals cos x)
    \`\`\`

Never emit a LaTeX expression without its plain-text fallback. The fallback must make the expression fully understandable on its own.

### 2. Tables
Reproduce any table from the source image using GFM pipe-table syntax (supported by both renderers):
\`| Column A | Column B |\\n|---|---|\\n| value | value |\`
Never use HTML \`<table>\` tags.

### 3. Figures / images
If the question references a diagram or figure visible in the image, describe it with an italicised caption:
\`*[Figure: a bar chart showing population growth from 1900 to 2000]*\`

### 4. Code / data
Wrap code or data values in backticks (inline) or fenced code blocks with a language tag.

### 5. Lists
Use \`-\` for unordered and \`1.\` for ordered lists where the source uses them.

### 6. Emphasis
\`**bold**\` and \`*italic*\` only — never HTML tags such as \`<b>\` or \`<em>\`.

### 7. General
- Never emit raw HTML tags anywhere.
- Never escape Markdown syntax unnecessarily.
- Preserve every piece of data visible on the page; do not summarise or truncate.

Return a JSON object with this exact schema:
{
  "questions": [
    {
      "id": "string",
      "text": "The question text in compatible Markdown",
      "choices": [
        { "text": "Option A in compatible Markdown", "isCorrect": false },
        { "text": "Option B in compatible Markdown", "isCorrect": true }
      ],
      "pageNumber": 1
    }
  ],
  "answerKeys": [
    {
      "id": "string",
      "answers": { "q1": "A", "q2": "B" },
      "questionRefs": ["q1", "q2"],
      "pageNumber": 2
    }
  ]
}`;

const ENHANCEMENT_PROMPT = `You are a trivia question enhancer. Given a trivia question with its choices (which may already contain Markdown, LaTeX math, or tables), generate a hint, an explanation, and an AI quality score.

## CRITICAL — Markdown compatibility rules
Both "hint" and "explanation" fields MUST be written in **GitHub-Flavored Markdown (GFM)**.
The output is rendered by TWO different engines:
  • Web/Admin — react-markdown v10 with remark-gfm, remark-math, and rehype-katex (full KaTeX support)
  • Mobile    — react-native-markdown-display v7 (markdown-it, NO math plugin installed)

Follow every rule below:

1. **Mathematical formulas** — Always write math in LaTeX notation AND include a plain-text fallback in parentheses on the same line:
   Inline: \`$E = mc^2$ (E equals m times c squared)\`
   Block:  \`$$\\frac{a}{b}$$ (a divided by b)\`
2. **Tables** — use GFM pipe-table syntax if comparisons or data need to be displayed; never use HTML \`<table>\` tags.
3. **Code / data values** — wrap in backticks or fenced code blocks.
4. **Bold / italic** — \`**bold**\` and \`*italic*\` only; no HTML tags.
5. Never emit raw HTML tags anywhere.
6. Keep the hint concise (1–2 sentences) without giving away the answer.
7. Keep the explanation concise (2–3 sentences) and accurate.

Return a JSON object with this exact schema:
{
  "hint": "A short, helpful clue without giving away the answer (compatible Markdown)",
  "explanation": "A concise 2-3 sentence explanation of why the correct answer is right (compatible Markdown)",
  "aiQualityScore": 75
}`;

// ── Configuration ───────────────────────────────

const FAST_MODEL = 'gemini-2.0-flash';
const HEAVY_MODEL = 'gemini-2.5-pro';
const ENHANCEMENT_MODEL = 'gemini-2.5-pro';

const UPLOAD_BATCH_SIZE = 20;

// ── Orchestrator ────────────────────────────────

export class IngestionOrchestrator {
  private state: IngestionState;

  constructor(
    bookId: string,
    private readonly imagePaths: string[],
    private readonly config: {
      outputDir: string;
      topic: string;
      difficultyLevel?: DifficultyLevel;
      categorySlug: string;
    },
  ) {
    this.state = new IngestionState(bookId, config.outputDir);
  }

  async run(): Promise<void> {
    this.state.initOrLoad();
    console.log(`[Orchestrator] Starting ingestion for ${this.imagePaths.length} images`);

    await this.scoutPhase();
    await this.extractionPhase();
    await this.enhancementPhase();
    await this.uploadPhase();

    console.log('[Orchestrator] Ingestion complete');
  }

  // ── Phase 1: Scout ────────────────────────────

  private async scoutPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const startIndex = stateData.lastProcessedImageIndex + 1;

    console.log(`[Scout] Starting from image ${startIndex}`);

    for (let i = startIndex; i < this.imagePaths.length; i++) {
      const imagePath = this.imagePaths[i];

      try {
        const { base64, mimeType } = this.imageToBase64(imagePath);
        const stateData = this.state.initOrLoad();
        const existingMeta = (stateData.metadata as Record<string, unknown>) ?? {};
        const imageClassifications = (existingMeta.imageClassifications as Record<string, ImageType>) ?? {};

        const classification = await this.classifyImage(base64, mimeType);
        imageClassifications[imagePath] = classification;

        this.state.updateMetadata({
          ...existingMeta,
          imageClassifications,
        });

        this.state.setLastProcessedImageIndex(i);
        console.log(`[Scout] Image ${i} classified as ${classification}`);
      } catch (error) {
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'scout',
          imageIndex: i,
          imagePath,
        });
        // Continue — fault tolerant
      }
    }
  }

  private async classifyImage(base64Image: string, mimeType: string): Promise<ImageType> {
    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: SCOUT_PROMPT },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (!response.text) {
      throw new Error('Fast MMLL returned empty response');
    }

    const parsed = JSON.parse(response.text) as { classification: ImageType };
    return parsed.classification;
  }

  // ── Phase 2: Extraction ───────────────────────

  private async extractionPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const imageClassifications = (stateData.metadata?.imageClassifications as Record<string, ImageType>) ?? {};

    const questionImages: string[] = [];
    const answerKeyImages: string[] = [];

    for (const [imagePath, classification] of Object.entries(imageClassifications)) {
      if (classification === 'QUESTIONS') questionImages.push(imagePath);
      if (classification === 'ANSWER_KEY') answerKeyImages.push(imagePath);
    }

    if (questionImages.length === 0) {
      console.log('[Extraction] No QUESTION images found');
      return;
    }

    console.log(`[Extraction] Processing ${questionImages.length} questions, ${answerKeyImages.length} answer keys`);

    const groups = this.buildImageGroups(questionImages, answerKeyImages);

    for (const group of groups) {
      try {
        const allImages = [...group.questions, ...group.answerKeys];
        const base64Images = allImages.map((img) => this.imageToBase64(img));

        const extracted = await this.extractFromImages(base64Images);

        for (const eq of extracted.questions) {
          const question: Question = {
            id: eq.id,
            text: eq.text,
            status: 'AWAITING_KEY',
            metadata: {
              choices: eq.choices,
              pageNumber: eq.pageNumber,
              answerKeyRef: eq.answerKeyRef,
            },
          };
          this.state.upsertQuestion(question);
        }

        if (extracted.answerKeys.length > 0) {
          const existingMeta = (this.state.initOrLoad().metadata as Record<string, unknown>) ?? {};
          const existingAKs = (existingMeta.answerKeys as any[]) ?? [];
          existingAKs.push(...extracted.answerKeys);
          this.state.updateMetadata({
            ...existingMeta,
            answerKeys: existingAKs,
          });
        }

        this.reconcileAnswerKeys();
      } catch (error) {
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'extraction',
          group,
        });
      }
    }
  }

  private async extractFromImages(base64Images: { base64: string; mimeType: string }[]): Promise<{ questions: ExtractedQuestion[]; answerKeys: ExtractedAnswerKey[] }> {
    const parts: any[] = [
      { text: EXTRACTION_PROMPT },
      ...base64Images.map((img) => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64,
        },
      })),
    ];

    const response = await ai.models.generateContent({
      model: HEAVY_MODEL,
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (!response.text) {
      throw new Error('Heavy MMLL returned empty response');
    }

    return JSON.parse(response.text);
  }

  private buildImageGroups(questionImages: string[], answerKeyImages: string[]): ImageGroup[] {
    if (answerKeyImages.length === 0 || questionImages.length === 0) {
      return questionImages.map((q) => ({ questions: [q], answerKeys: [] }));
    }

    const groups: ImageGroup[] = [];
    let currentGroup: string[] = [];

    for (let i = 0; i < questionImages.length; i++) {
      currentGroup.push(questionImages[i]);

      const nextImg = questionImages[i + 1] ?? answerKeyImages[0];
      if (answerKeyImages.includes(nextImg)) {
        const akForGroup: string[] = [];
        while (answerKeyImages.length > 0) {
          akForGroup.push(answerKeyImages.shift()!);
          break; // take one answer key per group for simplicity
        }
        groups.push({ questions: [...currentGroup], answerKeys: akForGroup });
        currentGroup = [];
      }
    }

    if (currentGroup.length > 0) {
      groups.push({ questions: currentGroup, answerKeys: [] });
    }

    return groups;
  }

  private reconcileAnswerKeys(): void {
    const stateData = this.state.initOrLoad();
    const answerKeys = ((stateData.metadata?.answerKeys as any[]) ?? []) as ExtractedAnswerKey[];

    for (const q of stateData.questions) {
      if (q.status !== 'AWAITING_KEY') continue;

      let hasAnswer = false;
      for (const ak of answerKeys) {
        if (ak.answers[q.id]) {
          this.state.upsertQuestion({
            ...q,
            answer: ak.answers[q.id],
            status: 'READY_FOR_ENHANCEMENT',
          });
          hasAnswer = true;
          break;
        }
      }

      // If answer came directly from extraction choices, no need for answer key
      if (!hasAnswer && q.metadata?.answerKeyRef) {
        this.state.upsertQuestion({
          ...q,
          status: 'READY_FOR_ENHANCEMENT',
        });
      }
    }
  }

  // ── Phase 3: Enhancement ──────────────────────

  private async enhancementPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const questionsToEnhance = stateData.questions.filter((q) => q.status === 'READY_FOR_ENHANCEMENT');

    console.log(`[Enhancement] Enhancing ${questionsToEnhance.length} questions`);

    for (const question of questionsToEnhance) {
      try {
        const enhanced = await this.enhanceQuestion(question);

        this.state.upsertQuestion({
          ...question,
          status: 'READY_FOR_UPLOAD',
          metadata: {
            ...question.metadata,
            hint: enhanced.hint,
            explanation: enhanced.explanation,
            aiQualityScore: enhanced.aiQualityScore,
          },
        });

        console.log(`[Enhancement] Enhanced ${question.id}`);
      } catch (error) {
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'enhancement',
          questionId: question.id,
        });
      }
    }
  }

  private async enhanceQuestion(question: Question): Promise<EnhancedQuestion> {
    const promptText = `Question: ${question.text}\nChoices: ${JSON.stringify(question.metadata?.choices)}

Return a JSON object with: hint, explanation, aiQualityScore`;

    const response = await ai.models.generateContent({
      model: ENHANCEMENT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: ENHANCEMENT_PROMPT }, { text: promptText }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (!response.text) {
      throw new Error('Enhancement LLM returned empty response');
    }

    const parsed = JSON.parse(response.text) as Omit<EnhancedQuestion, 'id'>;

    return {
      id: question.id,
      hint: parsed.hint,
      explanation: parsed.explanation,
      aiQualityScore: parsed.aiQualityScore,
    };
  }

  // ── Phase 4: Upload ─────────────────────────────

  private async uploadPhase(): Promise<void> {
    const stateData = this.state.initOrLoad();
    const readyQuestions = stateData.questions.filter((q) => q.status === 'READY_FOR_UPLOAD');

    console.log(`[Upload] Uploading ${readyQuestions.length} questions`);

    if (readyQuestions.length === 0) return;

    for (let i = 0; i < readyQuestions.length; i += UPLOAD_BATCH_SIZE) {
      const batch = readyQuestions.slice(i, i + UPLOAD_BATCH_SIZE);

      try {
        const duplicateFlags = await Promise.all(batch.map((q) => checkIsDuplicate(q.text)));

        const nonDuplicates: Question[] = [];
        for (let j = 0; j < batch.length; j++) {
          if (!duplicateFlags[j]) {
            nonDuplicates.push(batch[j]);
          }
        }

        if (nonDuplicates.length === 0) {
          console.log(`[Upload] Batch ${i / UPLOAD_BATCH_SIZE + 1}: all duplicates`);
          continue;
        }

        const rows = nonDuplicates.map((q) => ({
          topic: this.config.topic,
          categorySlug: this.config.categorySlug,
          difficultyLevel: (this.config.difficultyLevel ?? 'MEDIUM') as DifficultyLevel,
          suggestedText: q.text,
          suggestedChoices: shuffleArray((q.metadata?.choices as any[]) ?? []),
          hint: (q.metadata?.hint as string) ?? null,
          explanation: (q.metadata?.explanation as string) ?? null,
          status: 'PENDING',
          isDuplicate: false,
          isValidated: false,
          aiQualityScore: (q.metadata?.aiQualityScore as number) ?? undefined,
          aiFeedback: null,
        }));

        await prisma.pendingQuestion.createMany({ data: rows as any });

        for (const q of nonDuplicates) {
          this.state.updateStatus(q.id, 'UPLOADED');
        }

        console.log(`[Upload] Batch ${i / UPLOAD_BATCH_SIZE + 1}: inserted ${rows.length}`);
      } catch (error) {
        reportError(error instanceof Error ? error : new Error(String(error)), {
          phase: 'upload',
          batchIndex: i,
        });
      }
    }
  }

  // ── Utilities ───────────────────────────────────

  private imageToBase64(imagePath: string): { base64: string; mimeType: string } {
    const buffer = fs.readFileSync(imagePath);
    const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'png';
    const mimeType = `image/${ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : 'png'}`;

    return {
      base64: buffer.toString('base64'),
      mimeType,
    };
  }
}
