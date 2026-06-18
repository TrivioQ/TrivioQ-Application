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

export const ENHANCEMENT_PROMPT = `You are a trivia question enhancer. Given a trivia question with its choices (which may already contain Markdown, LaTeX math, or tables), generate a hint, an explanation, an AI quality score, a difficulty level, a topic, and 1-2 category slugs.

## CRITICAL — Fact Checking & Anti-Hallucination
STRICT ANTI-HALLUCINATION RULE: Do not hallucinate or fabricate any facts in your hint or explanation. Stick strictly to verified, factual data.
Perform a strict fact check on the question and the provided choices. Ensure that the question is factually accurate and the option marked as correct is indeed the true answer. If there are factual errors or the marked answer is wrong, record this in factCheckRationale and set isFactuallyCorrect to false. If everything is accurate, set isFactuallyCorrect to true.

## CRITICAL — Markdown compatibility rules
Both "hint" and "explanation" fields MUST be written in **GitHub-Flavored Markdown (GFM)**.
The output is rendered by TWO different engines:
  • Web/Admin — react-markdown v10 with remark-gfm, remark-math, and rehype-katex (full KaTeX support)
  • Mobile    — react-native-markdown-display v7 (markdown-it, with mathjax3 plugin installed)

Follow every rule below:

1. **Mathematical formulas** — Always write math in standard LaTeX notation:
   Inline: \`$E = mc^2$\`
   Block:  \`$$\frac{a}{b}$$\`
2. **Tables** — use GFM pipe-table syntax if comparisons or data need to be displayed; never use HTML \`<table>\` tags.
3. **Code / data values** — wrap in backticks or fenced code blocks.
4. **Bold / italic** — \`**bold**\` and \`*italic*\` only; no HTML tags.
5. Never emit raw HTML tags anywhere.
6. Keep the hint concise (1–2 sentences) without giving away the answer.
7. Keep the explanation concise (2–3 sentences) and accurate.

## Difficulty classification
Assess the question and assign a difficulty level with keeping the average user in mind:
- "EASY"   — factual recall, widely known, requires no reasoning
- "MEDIUM" — requires some domain knowledge or light reasoning
- "HARD"   — requires detailed knowledge, deeper reasoning, or is tricky

## Topic and Categories
You must assign a concise \`topic\` (e.g. "World War 2", "Javascript Fundamentals", "Quantum Physics") that best describes the question.
You must also assign an array of \`categorySlugs\` consisting of minimum 1 and maximum 2 slugs chosen from the [AVAILABLE CATEGORIES] list provided below. Choose the most relevant ones.

[AVAILABLE_CATEGORIES_PLACEHOLDER]

Return a JSON object with this exact schema:
{
  "topic": "A short, concise topic string",
  "categorySlugs": ["slug1", "slug2"],
  "hint": "A short, helpful clue without giving away the answer (compatible Markdown)",
  "explanation": "A concise 2-3 sentence explanation of why the correct answer is right (compatible Markdown)",
  "aiQualityScore": 75,
  "difficulty": "EASY|MEDIUM|HARD",
  "isFactuallyCorrect": true,
  "factCheckRationale": "Reasoning if factually incorrect, otherwise null"
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
