// ── Prompts ───────────────────────────────────────────────────────────────────
// All AI prompts live here so every provider imports from one place.
// Changes to a prompt are automatically reflected in all providers.

export const SCOUT_PROMPT = `You are a strict document classifier. Analyze the provided page image and classify it into one of these categories:
- "QUESTIONS_WITH_KEYS" — Classify as this if the page contains a distinct grid, list, or table of answer mappings (e.g., "1: A, 2: B", "Q1) D, Q2) B", or a large Answer Key table) for multiple questions. This takes PRIORITY. If you see an answer key list or table, choose this category even if there is no explicit "Answer Key" header, and even whether regular questions are present on the page or not.
- "QUESTIONS_WITH_KEY_UNDERNEATH" — ONLY classify as this if the image explicitly contains text like "Answer: A" or "Answer: 2" printed directly below or next to the question (or its multiple-choice options, even if the question stem itself is missing or on the previous page).

CRITICAL: Some pages have questions with answers printed directly below them (e.g. "Answer: C"). NEVER classify these as "QUESTIONS_WITH_KEYS". ONLY classify as "QUESTIONS_WITH_KEYS" if there is a DISTINCT table/grid of answer keys.

- "QUESTIONS" — classify as this if the page contains trivia/quiz questions, OR if it contains the continuation of a question from a previous page (e.g., just the multiple-choice options like (A), (B), (C), (D)). Choose this if there are NO answer keys on the page.
- "OTHER" — anything else (table of contents, blank pages, advertisements, title pages, prefaces, syllabuses, instructional pages, or any page WITHOUT actual questions, question continuations, or answer keys).

CRITICAL: If the page does NOT contain any actual questions, question continuations (like isolated multiple-choice options), or answer keys, you MUST classify it as "OTHER".

Return ONLY a JSON object with this exact schema. Do not include markdown, explanations, or any other text:
{"classification": "QUESTIONS|QUESTIONS_WITH_KEYS|QUESTIONS_WITH_KEY_UNDERNEATH|OTHER", "confidence": 0.0-1.0}`;

export const KEY_EXTRACTION_PROMPT = `You are an expert answer key extractor. Given an image containing an answer key table for trivia questions, extract ONLY the answer key table.
DO NOT extract any questions from the image. Only extract the answer key mapping.

Return a JSON object with this exact schema:
{
  "answerKeys": [
    {
      "id": "ak_p<pageNumber>",
      "answers": { "1": "D", "2": "C", "3": "B", "26": "A", "51": "C" },
      "pageNumber": <pageNumber>
    }
  ]
}`;

export const EXTRACTION_PROMPT = `You are an expert trivia question extractor. Given images containing trivia questions (and possibly their answer keys), extract all questions with their multiple-choice options.

## 1. Output Format Rules
- All "text" fields (question and options) must be in GitHub-Flavored Markdown (GFM).
- Never use raw HTML tags (e.g., <b>, <table>).
- Preserve data exactly: do not summarize or truncate content.
- Fix OCR artifacts: correct word-merging (e.g., "NagarholeNational" -> "Nagarhole National").
- Do not add, remove, or hallucinate content not present in the image.

## 2. Mathematical Formulas
For every LaTeX formula, provide:
  a) The LaTeX expression (e.g., \`$E = mc^2$\`)
  b) A plain-text readable fallback in parentheses immediately after, e.g., \`$E = mc^2$ (E equals m times c squared)\`.
  *This is mandatory for all math to support dual-renderer compatibility.*

## 3. Structural Elements
- **Tables**: Use GFM pipe-table syntax. Never use HTML \`<table>\` tags.
- **Figures**: If a question references a diagram, describe it: \`*[Figure: description]*\`
- **Code/Data**: Use backticks for inline or fenced blocks for multi-line code.
- **Emphasis**: Use only \`**bold**\` or \`*italic*\`. Never use HTML tags.

## 4. CRITICAL — Numbered List Formatting
**"Consider the following statements" / "Which of the following" questions MUST use proper Markdown line breaks.**

Any question with numbered sub-items (1., 2., 3., etc.) MUST follow this structure:
- The opening stem ends with a colon followed by \`\\n\`
- Each numbered item is on its own line: \`1. Item text\\n\`
- The closing question is separated by a blank line (\`\\n\\n\`)

✅ CORRECT (always use this):
\`Consider the following statements about X:\\n1. Statement one.\\n2. Statement two.\\n3. Statement three.\\n\\nHow many of the statements given above are correct?\`

❌ WRONG (never do this):
\`Consider the following statements about X: 1. Statement one. 2. Statement two. 3. Statement three. How many of the statements given above are correct?\`

This rule applies to ALL multi-item structures — statements, names, places, conditions, or code snippets.

## 5. Complex Question Structures (Items vs Final Choices)
Some questions present a list of items (statements, names, places) followed by final choices that combine them (e.g., "1 and 2", "2, 3 and 4").
- **Sub-Items are NOT Choices:** The intermediate list of items (even if labeled a, b, c, d or 1, 2, 3, 4 in the image) MUST be included in the main "text" of the question. You should normalize their labels to a numbered list (1., 2., 3., 4.) to match the final choices.
- **Final Choices ONLY:** The "choices" array MUST contain ONLY the final selectable options (e.g., "1, 2 and 3", "1 and 4"). DO NOT put the intermediate items into the "choices" array.

## 6. Multiple-Choice Options
Completely strip all leading identifiers (e.g., "A)", "B.", "a.", "b)", "(i)", "(ii)") from choice text. The "text" field must contain ONLY the raw option value with no prefix.

## 7. Questions Spanning Multiple Columns or Pages
If a question or passage starts at the bottom of one column/page and continues on the next, stitch them into a single question object. Do not split or drop it. Be mindful of multi-column layouts where text wraps from the bottom of one column to the top of the next.

## 8. Answer Keys (CRITICAL ANTI-HALLUCINATION)
- Do NOT guess or solve questions under any circumstances.
- Set \`isCorrect: true\` ONLY if the correct answer is explicitly marked inline in the source image (e.g., printed next to the question).
- If no answer is explicitly shown, set \`isCorrect: false\` for ALL choices. This is the default and expected case — answer keys are usually on a separate page.
- **Answer key tables**: ONLY extract into the \`answerKeys\` array if a physical answer key table is VISIBLY PRINTED on the current page image. DO NOT fabricate or hallucinate an \`answerKeys\` block to solve the questions yourself. If no answer key is printed on the page, leave the \`answerKeys\` array empty or omit it. Use the **exact question number as printed in the table** (e.g., "1", "2", "26", "51") as the key in the \`answers\` map.

## 9. Passage-Dependent Questions
**TYPE A — Inline passage (EXTRACT):** The passage is embedded in the question text itself. Extract it as-is, including the quoted text.
**TYPE B — External passage reference (DISCARD):** The question references a passage not visible in the current image(s). Silently skip these questions.

## 10. Question IDs
Generate IDs using the format \`p<pageNumber>_<originalQuestionNumber>\` where the number is the actual printed question number from the source (e.g., if page 7 has questions 29, 30, 31, the IDs are \`p7_29\`, \`p7_30\`, \`p7_31\`). If a question has no visible number, use a sequential fallback starting from 1 (e.g., \`p<pageNumber>_1\`, \`p<pageNumber>_2\`).

## 11. Original Question Number
Extract the explicit question number printed next to the question (e.g., if the question starts with "105. ", extract "105"). **Strip this number prefix from the question text** so the text begins with the actual content. If the question has no visible number, set this to null. Do NOT include periods, spaces, or brackets.

Return a JSON object with this exact schema. The examples below show the expected GFM markdown formatting:
{
  "questions": [
    {
      "id": "p5_29",
      "text": "Consider the following statements about the Mughal Empire:\\n1. Akbar introduced the Mansabdari system.\\n2. Aurangzeb abolished the jiziya tax.\\n3. Humayun built the Taj Mahal.\\n\\nHow many of the statements given above are **correct**?",
      "choices": [
        { "text": "Only one", "isCorrect": false },
        { "text": "Only two", "isCorrect": false },
        { "text": "All three", "isCorrect": false },
        { "text": "None", "isCorrect": false }
      ],
      "pageNumber": 5,
      "originalQuestionNumber": "29"
    },
    {
      "id": "p5_30",
      "text": "Which one of the following is **not** a feature of the Indian Constitution?",
      "choices": [
        { "text": "Federal system with unitary bias", "isCorrect": false },
        { "text": "Parliamentary form of government", "isCorrect": false },
        { "text": "Dual citizenship", "isCorrect": false },
        { "text": "Independent judiciary", "isCorrect": false }
      ],
      "pageNumber": 5,
      "originalQuestionNumber": "30"
    }
  ],
  "answerKeys": [
    {
      "id": "ak_p12",
      "answers": { "1": "D", "2": "C", "3": "B", "26": "A", "51": "C" },
      "pageNumber": 12
    }
  ]
}`;

export const ENHANCEMENT_PROMPT = `You are a trivia question quality reviewer and enhancer. Given a trivia question with its choices, generate a hint, an explanation, an AI quality score, a difficulty level, a topic, and 1-3 category slugs.

## CRITICAL — Fact Checking & Anti-Hallucination
STRICT ANTI-HALLUCINATION RULE: Do not hallucinate or fabricate any facts in your hint or explanation. Stick strictly to verified, factual data.
Perform a strict fact check on the question and the provided choices. Verify that the question is factually accurate AND that the option marked as correct is unambiguously the true answer.
- If everything is accurate, set \`isFactuallyCorrect: true\` and write a brief confidence statement in \`factCheckRationale\` (e.g., "Confirmed: the cheetah's top speed of ~120 km/h is well documented.").
- If there are factual errors or the marked answer is wrong, set \`isFactuallyCorrect: false\` and explain the error in \`factCheckRationale\`.
- \`factCheckRationale\` must NEVER be null. Always provide a short statement regardless of outcome.

## CRITICAL — AI Quality Score
The "aiQualityScore" (0–100) reflects the standalone educational quality of the trivia question. Apply the full rubric below:

**90–100 (Excellent):** Specific, standalone, factually correct question with a surprising or interesting fact. Well-crafted distractors that are plausible but clearly wrong. No ambiguity.
**75–89 (Good):** Solid standalone question. Fact is accurate. Distractors are reasonable. Minor phrasing issues or slightly generic topic.
**50–74 (Average):** The question works but has one of: vague distractors, slightly generic phrasing, or a fact that is too obvious. Still acceptable for a trivia app.
**25–49 (Poor):** Significant issues — question is not fully standalone, references "the text/page/summary", has lazy distractors (e.g., "None of the above"), or fact is hard to verify.
**0–24 (Reject):** Fundamentally broken — factually wrong, completely context-dependent, or the correct answer is indeterminate.

**Additional deductions:**
- Deduct 20 points if the question references "the text", "the page", "the section", "the image", or relies on source material context.
- Deduct 10 points if all distractors are obviously unrelated to the correct answer's category or unit (e.g., mixing apples and oranges).
- Deduct 10 points if the hint gives away the answer or names the correct answer directly.

## CRITICAL — Hint Quality
The hint must be a genuinely helpful nudge without giving away the answer:
- Do NOT name, describe, or closely paraphrase the correct answer option.
- Do NOT hint at the answer's category too specifically if it makes the correct answer trivially obvious.
- Do NOT repeat words from the question stem that directly point to the answer.
- Keep it to 1–2 sentences. It should narrow down the choices without eliminating all wrong answers.

## CRITICAL — Markdown compatibility rules
Both "hint" and "explanation" fields MUST be written in **GitHub-Flavored Markdown (GFM)**.
The output is rendered by TWO different engines:
  • Web/Admin — react-markdown v10 with remark-gfm, remark-math, and rehype-katex (full KaTeX support)
  • Mobile    — react-native-markdown-display v7 (markdown-it, with mathjax3 plugin installed)

Follow every rule below:

1. **Mathematical formulas** — Always write math in standard LaTeX notation:
   Inline: \`$E = mc^2$\`
   Block:  \`$$\\frac{a}{b}$$\`
2. **Tables** — use GFM pipe-table syntax if comparisons or data need to be displayed; never use HTML \`<table>\` tags.
3. **Code / data values** — wrap in backticks or fenced code blocks.
4. **Bold / italic** — \`**bold**\` and \`*italic*\` only; no HTML tags.
5. Never emit raw HTML tags anywhere.
6. Keep the hint concise (1–2 sentences) without giving away the answer.
7. Keep the explanation concise (2–3 sentences) and accurate.

## Difficulty classification
Assess the question independently and assign a difficulty level with the average general-knowledge quiz player in mind:
- "EASY"   — factual recall, widely known, requires no reasoning (e.g., "What is the fastest land animal?")
- "MEDIUM" — requires some domain knowledge or light reasoning (e.g., "What is the approximate top speed of a cheetah?")
- "HARD"   — requires detailed, specific knowledge or is tricky (e.g., "Over what distance can a cheetah sustain its maximum sprint speed?")

## Topic and Categories
- \`topic\`: A **specific** subject string describing the precise concept or entity the question is about (e.g., "Cheetah Locomotion", "Vertebrate Classification", "Earth's Ecosystems"). Do NOT use generic topics like "Animals" or "Science" — those belong in categories.
- \`categorySlugs\`: 1–3 slugs chosen ONLY from the [AVAILABLE CATEGORIES] list below. You MUST NOT invent, hallucinate, or use any category slugs that are not exactly as they appear in the provided list. Choose the most relevant ones.

**CRITICAL — Category boundary rules (apply these BEFORE assigning any slug):**
- \`"life-sciences-medicine"\` MUST ONLY be used for questions specifically about **human** health, the human body, human anatomy, or medicine/medical treatments. Do NOT use it for animal biology, zoology, animal anatomy, animal classification, ecology, or evolutionary biology — use \`"animals-wildlife"\` or \`"environmental-earth-sciences"\` for those instead.

## Age Rating
Classify the question into exactly one of the three tiers below. Default to "ALL" unless the content clearly meets a higher tier's criteria.

- **"ALL"** (default) — educational, factual, or general-knowledge content safe for any age (13+).
  Examples: animal biology, geography, history of art, space science, sports records.
- **"TEEN"** — questions that involve mild mature themes appropriate for ages 16+ but not requiring adult classification.
  Examples: questions about alcohol/drug history in a historical/scientific context (e.g., "In which year was Prohibition enacted in the US?"), mild wartime violence (e.g., "How many soldiers died in the Battle of the Somme?"), basic human reproduction or anatomy in an educational setting.
- **"MATURE"** — questions explicitly about adult-only content (18+). Use this tier sparingly and only when the content is unambiguously adult.
  Examples: explicit drug use culture, graphic descriptions of violence, adult sexual content or practices.

## CRITICAL — Self-Referential Question Detection
Set \`isSelfReferential: true\` if the question's correct answer is **only meaningful because of the specific source document being processed** — i.e., the question is about the book/publication itself as an artifact, not about any real-world fact.

Ask yourself: *"If I removed the source document from existence, would this question and answer still be valid world-knowledge trivia?"*
- If **NO** → \`isSelfReferential: true\` (discard)
- If **YES** → \`isSelfReferential: false\` (keep)

**\`isSelfReferential: true\` examples (discard):**
- "Who published this encyclopedia?" → Only answerable by reading this book's cover.
- "How many glossary entries does this book have?" → Artifact of this document's structure.
- "What is shown on the cover of this book?" → Meaningless without this specific book.
- "How many record-breakers are listed in this publication's life stories section?" → Internal document metric.

**\`isSelfReferential: false\` examples (keep — these are real-world trivia):**
- "Which publisher released *Sapiens* by Yuval Noah Harari?" → A verifiable real-world fact.
- "Who wrote the biography of Nelson Mandela titled *Long Walk to Freedom*?" → Real-world literary knowledge.
- "What year was Charles Darwin's *On the Origin of Species* first published?" → Historical fact.
- "Which author wrote the *Harry Potter* series?" → General knowledge.

When \`isSelfReferential: true\`, also set \`aiQualityScore\` to 0–5 to reflect the question's lack of standalone value.

[AVAILABLE_CATEGORIES_PLACEHOLDER]

Return a JSON object with this exact schema:
{
  "topic": "A specific subject string (not a generic domain label)",
  "categorySlugs": ["slug1", "slug2"],
  "hint": "A helpful 1-2 sentence clue that does not reveal the answer",
  "explanation": "A concise 2-3 sentence explanation of why the correct answer is right (compatible Markdown)",
  "aiQualityScore": 75,
  "difficulty": "EASY|MEDIUM|HARD",
  "ageRating": "ALL|TEEN|MATURE",
  "isFactuallyCorrect": true,
  "factCheckRationale": "Always populated — brief confirmation if correct, error description if not",
  "isSelfReferential": false
}`;

export const SUMMARIZE_IMAGE_PROMPT = `You are an expert encyclopedic fact extractor. Your task is to read the provided page image and extract a maximum of the 15 most important, discrete, standalone educational facts it contains.

## CRITICAL — Page Orientation
Some pages in this corpus were physically scanned or printed sideways or upside-down, so text and figures may appear rotated (0°, 90°, 180°, or 270°) within an otherwise upright page. Before extracting anything, mentally rotate the page into the orientation in which the text reads normally and naturally left-to-right, then read ALL content (body text, captions, labels on diagrams, keys on maps, values in charts) from that reoriented perspective. Treat rotated diagrams, charts, and maps the same way — their labels and legends carry facts just like body text. Do not skip a page solely because its content appears sideways.

## CRITICAL RULES
- LIMIT EXHAUSTION: For highly complex maps, charts, or dense pages, do NOT attempt to extract every minor label or detail. Limit yourself to the 15 most prominent, high-level educational takeaways.
- Each bullet must be a self-contained, standalone factual statement (e.g., "The cheetah can reach speeds of up to 120 km/h" not "The image shows a cheetah").
- Prioritize specific, precise, and quiz-worthy facts: scientific names, numerical statistics, record-breakers, unique adaptations, life-cycle details, classifications, habitats, and behaviors.
- Explicitly extract ALL numeric data: counts, sizes, speeds, weights, temperatures, percentages, depths, dates, and durations.
- Describe factual content from diagrams, charts, maps, or infographics (e.g., "The diagram shows that 9.5% of Earth's land surface is savanna"). Do NOT describe the image's visual layout or style.
- SKIP pages that are purely navigational (tables of contents, indexes, glossaries, covers) — return an empty array for those.
- Do NOT write meta-observations like "The image is a page from..." or "The page features...". Output ONLY content-level facts.
- Do NOT hallucinate information. Only extract facts explicitly visible on the page.
- Do NOT generate questions.

Your entire response MUST be a raw, valid JSON object. Do NOT include markdown formatting, markdown code blocks (e.g., \`\`\`json), or any conversational text before or after the JSON.
Return a JSON object with this exact schema:
{
  "summary": [
    "Fact 1 (a specific, standalone educational fact)",
    "Fact 2 (a specific, standalone educational fact)"
  ]
}`;

export const QUIZ_GENERATION_FROM_TEXT_PROMPT = `You are an expert trivia question writer. Your task is to generate high-quality, engaging multiple-choice trivia questions based entirely on the provided facts.

## CRITICAL RULES
- Output a maximum of the top 10 highest-quality questions. Prioritize facts that are specific, surprising, and quiz-worthy. Generate fewer than 10 if there are not enough distinct, high-quality facts.
- Output an empty questions array if the facts do not contain valid trivia material (e.g., the page was a table of contents or index).
- Prefer facts with specific, verifiable details: scientific names, numerical statistics, record-breakers, unique adaptations, and biological classifications make for the best trivia.
- Each question MUST be derived from a different source fact. Do NOT write two questions about the same fact or topic.
- Ensure every question is 100% self-contained. It must make complete sense with no surrounding context (e.g., instead of "What size does this animal grow to?", use "What size does the Goliath Beetle grow to?").
- NEVER refer to "the text", "the summary", "the passage", or "the image" in questions. Ask direct, encyclopedic factual questions.
- Write questions in plain, conversational English. Do NOT use markdown formatting (no bold, italics, backticks, or bullet points) in question or answer text.
- Enforce a balanced difficulty spread across generated questions: approximately one-third EASY, one-third MEDIUM, and one-third HARD.
- DO NOT fabricate facts. Every question MUST be directly and unambiguously supported by the provided facts.
- Provide exactly 4 answer choices per question. Distractors must be plausible (same category/unit as the correct answer) but clearly wrong based on the facts.
- Randomize the position of the correct answer — do not always place it in the same slot.
- Mark exactly one correct option with isCorrect: true. All other options must be isCorrect: false.
- Your entire response MUST be a raw, valid JSON object. Do NOT include markdown formatting, markdown code blocks, or any conversational text.

Return a JSON object with this exact schema:
{
  "questions": [
    {
      "id": "gen_p<pageNumber>_<seq>",
      "text": "Question text here (plain text, no markdown)",
      "source_fact": "The exact fact from the summary that this question is based on",
      "choices": [
        { "text": "Option A (plain text)", "isCorrect": false },
        { "text": "Option B (plain text)", "isCorrect": true },
        { "text": "Option C (plain text)", "isCorrect": false },
        { "text": "Option D (plain text)", "isCorrect": false }
      ],
      "pageNumber": <pageNumber>,
      "difficulty": "EASY" | "MEDIUM" | "HARD",
      "originalQuestionNumber": null
    }
  ]
}`;

// ── Prompt builders ───────────────────────────────────────────────────────────
// Use these helpers when a per-book special instruction should be injected.

/**
 * Returns SCOUT_PROMPT optionally prefixed with a special instruction
 * sourced from the book's instructions.json.
 */
export function buildClassificationPrompt(specialInstruction?: string): string {
  if (!specialInstruction) return SCOUT_PROMPT;
  return `## Special instruction for this book\n${specialInstruction.trim()}\n\n${SCOUT_PROMPT}`;
}

/**
 * Extracts an array of question candidates from an array of images.
 * Uses `extractionSpecialInstruction` to provide an optional custom directive
 * sourced from the book's manifest.json.
 */
export function buildExtractionPrompt(spatialInstructions?: string[], specialInstruction?: string, pageNumbers?: number[]): string {
  let prompt = '';

  if (pageNumbers && pageNumbers.length > 0) {
    prompt += '## Page Numbers for this Batch\n';
    prompt += `The images provided correspond to the following page numbers in order: ${pageNumbers.join(', ')}. `;
    prompt += 'You MUST use these exact page numbers when generating the "id" and "pageNumber" fields for the extracted questions.\n\n';
  }

  if (spatialInstructions && spatialInstructions.length > 0) {
    prompt += '## Spatial/Boundary Instructions for this Batch\n';
    spatialInstructions.forEach((inst) => (prompt += `- ${inst}\n`));
    prompt += '\n';
  }

  if (specialInstruction) {
    prompt += `## Special instruction for this book\n${specialInstruction.trim()}\n\n`;
  }

  return prompt + EXTRACTION_PROMPT;
}

/**
 * Classifies an enhanced question.
 * Uses `classificationSpecialInstruction` to provide an optional custom directive
 * sourced from the book's manifest.json, and with the available categories injected.
 */
export function buildEnhancementPrompt(categories: { slug: string; name: string }[], specialInstruction?: string): string {
  const categoryListStr = categories.map((c) => `- "${c.slug}" (${c.name})`).join('\n');
  const basePrompt = ENHANCEMENT_PROMPT.replace('[AVAILABLE_CATEGORIES_PLACEHOLDER]', `[AVAILABLE CATEGORIES]\n${categoryListStr}`);

  if (!specialInstruction) return basePrompt;
  return `## Special instruction for this book\n${specialInstruction.trim()}\n\n${basePrompt}`;
}

/**
 * Constructs the prompt for summarizing an image.
 */
export function buildSummarizeImagePrompt(specialInstruction?: string): string {
  let prompt = '';

  if (specialInstruction) {
    prompt += `## Special instruction for this book\n${specialInstruction.trim()}\n\n`;
  }

  return prompt + SUMMARIZE_IMAGE_PROMPT;
}

/**
 * Constructs the prompt for generating quiz questions from text.
 */
export function buildQuizGenerationFromTextPrompt(specialInstruction?: string, pageNumber?: number): string {
  let prompt = '';

  if (pageNumber !== undefined) {
    prompt += '## Page Number\n';
    prompt += `The generated questions correspond to page ${pageNumber}. You MUST use this page number when generating the "id" and "pageNumber" fields for the generated questions.\n\n`;
  }

  if (specialInstruction) {
    prompt += `## Special instruction for this book\n${specialInstruction.trim()}\n\n`;
  }

  return prompt + QUIZ_GENERATION_FROM_TEXT_PROMPT;
}

// ── Validation Prompt ─────────────────────────────────────────────────────────
// Used by the nightly AI validation cron job to evaluate pending questions
// across three independent dimensions before they are surfaced to human reviewers.

/**
 * The structured result returned by the AI when VALIDATION_PROMPT is used.
 * Cast from the raw provider response via (result as unknown as ValidationResult).
 */
export interface ValidationResult {
  /** A step-by-step reasoning scratchpad to prevent hallucination before arriving at the final passed flags. */
  stepByStepAnalysis: string;
  factCheck: {
    /** True if the question text and the marked correct answer are factually accurate. */
    passed: boolean;
    /** Explanation if false, otherwise null. */
    rationale: string | null;
  };
  validity: {
    /** True if the question is well-formed, unambiguous, and answerable solely from the choices. */
    passed: boolean;
    rationale: string | null;
  };
  completeness: {
    /** True if exactly one choice is correct and at least two distractors are plausible. */
    passed: boolean;
    rationale: string | null;
  };
  ageRating: {
    /** True if the question is appropriate for the assigned age rating. */
    passed: boolean;
    rationale: string | null;
  };
  hintQuality: {
    /** True if the hint is a helpful nudge without giving away the answer directly. */
    passed: boolean;
    rationale: string | null;
  };
  explanationQuality: {
    /** True if the explanation is factual, accurate, and properly explains why the answer is correct. */
    passed: boolean;
    rationale: string | null;
  };
  /** True only when ALL four dimensions pass. */
  overallPassed: boolean;
  /** One-sentence summary written to aiFeedback in the DB. */
  summary: string;
}

export function buildValidationPrompt(targetAgeRating: string): string {
  return `You are a strict trivia question validator. Evaluate the given trivia question, its choices, hint, and explanation across SIX independent dimensions and return a structured JSON result.

## CRITICAL INSTRUCTION — Chain of Thought
Before making your final boolean decisions, you MUST write out your step-by-step reasoning in the \\\`stepByStepAnalysis\\\` field. Think through the facts, check each item in the list/question individually, evaluate the hint and explanation, and explain your logical deduction to ensure accuracy.

## Dimension 1 — Fact Check
Verify that:
- The question text itself is factually accurate.
- The choice marked as correct is definitively the right answer.
- No other choice could also be considered correct.
Set factCheck.passed = false if ANY of the above fail.

## Dimension 2 — Validity
Verify that:
- The question is clearly worded and unambiguous.
- It can be answered from the given choices without requiring external context.
- It is a standalone question (not dependent on a passage or image not provided).
Set validity.passed = false if ANY of the above fail.

## Dimension 3 — Completeness
Verify that:
- Exactly one choice is marked as correct.
- All choices are meaningfully different from each other.
Set completeness.passed = false if ANY of the above fail.

## Dimension 4 — Age Rating (Target: ${targetAgeRating})
Verify that:
- The content of the question and its choices is appropriate for the target age rating (${targetAgeRating}).
- The difficulty and vocabulary are suitable for the target age group.
- There is no inappropriate, mature, or offensive content that violates the age guidelines.
Set ageRating.passed = false if ANY of the above fail.

## Dimension 5 — Hint Quality
Verify that:
- The hint is provided and is a genuinely helpful nudge.
- The hint does NOT give away the answer or directly name the correct option.
- The hint does NOT repeat words from the question stem that directly point to the answer.
Set hintQuality.passed = false if ANY of the above fail or if the hint is missing when it should be present.

## Dimension 6 — Explanation Quality
Verify that:
- The explanation is provided, factual, and accurate.
- The explanation correctly and concisely explains why the marked correct answer is right.
- There is no hallucination or fabrication of facts.
Set explanationQuality.passed = false if ANY of the above fail or if the explanation is missing.

## CRITICAL — Anti-Hallucination Rules
- Do NOT guess or fabricate facts. If you are unsure, set the dimension to passed = false and explain.
- Stick to verifiable, well-known facts only.

## Output Format
Return ONLY a JSON object matching this exact schema. Do not include markdown, explanations, or any text outside the JSON:
{
  "stepByStepAnalysis": "Your detailed step-by-step reasoning here. Do this FIRST.",
  "factCheck":    { "passed": true,  "rationale": null },
  "validity":     { "passed": true,  "rationale": null },
  "completeness": { "passed": true,  "rationale": null },
  "ageRating":    { "passed": true,  "rationale": null },
  "hintQuality":  { "passed": true,  "rationale": null },
  "explanationQuality": { "passed": true, "rationale": null },
  "overallPassed": true,
  "summary": "One-sentence summary of the validation outcome."
}

Set overallPassed = true ONLY when ALL six dimensions pass. The "summary" field must be a single sentence suitable for display in an admin portal.`;
}
