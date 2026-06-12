// ── Prompts ───────────────────────────────────────────────────────────────────
// All AI prompts live here so every provider imports from one place.
// Changes to a prompt are automatically reflected in all providers.

export const SCOUT_PROMPT = `You are a strict document classifier. Analyze the provided page image and classify it into one of these categories:
- "RELEVANT" — strictly contains actual trivia questions, quiz questions, or answer keys.
- "OTHER" — anything else (table of contents, blank pages, advertisements, title pages, prefaces, syllabuses, instructional pages, or any page WITHOUT actual questions or answer keys).

CRITICAL: If the page does NOT contain any actual questions or answer keys, you MUST classify it as "OTHER".

Return ONLY a JSON object with this exact schema. Do not include markdown, explanations, or any other text:
{"classification": "RELEVANT|OTHER", "confidence": 0.0-1.0}`;

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

## 5. Multiple-Choice Options
Completely strip all leading identifiers (e.g., "A)", "B.", "a.", "b)", "(i)", "(ii)") from choice text. The "text" field must contain ONLY the raw option value with no prefix.

## 6. Questions Spanning Multiple Pages
If a question starts at the bottom of one page and continues on the next, stitch them into a single question object. Do not split or drop it.

## 7. Answer Keys
- Do NOT guess or solve questions.
- Set \`isCorrect: true\` ONLY if the correct answer is explicitly marked inline in the source image (e.g., printed next to the question) or appears in an answer key table visible in the current page images.
- If no answer is explicitly shown, set \`isCorrect: false\` for ALL choices. This is the default and expected case — answer keys are usually on a separate page.

## 8. Passage-Dependent Questions
**TYPE A — Inline passage (EXTRACT):** The passage is embedded in the question text itself. Extract it as-is, including the quoted text.
**TYPE B — External passage reference (DISCARD):** The question references a passage not visible in the current image(s). Silently skip these questions.

## 9. Question IDs
Generate IDs using the format \`p<pageNumber>_<sequentialNumber>\` where the sequential number restarts at 1 for each new page (e.g., \`p5_1\`, \`p5_2\`, \`p6_1\`).

Return a JSON object with this exact schema. The examples below show the expected GFM markdown formatting:
{
  "questions": [
    {
      "id": "p5_1",
      "text": "Consider the following statements about the Mughal Empire:\\n1. Akbar introduced the Mansabdari system.\\n2. Aurangzeb abolished the jiziya tax.\\n3. Humayun built the Taj Mahal.\\n\\nHow many of the statements given above are **correct**?",
      "choices": [
        { "text": "Only one", "isCorrect": false },
        { "text": "Only two", "isCorrect": false },
        { "text": "All three", "isCorrect": false },
        { "text": "None", "isCorrect": false }
      ],
      "pageNumber": 5
    },
    {
      "id": "p5_2",
      "text": "Which one of the following is **not** a feature of the Indian Constitution?",
      "choices": [
        { "text": "Federal system with unitary bias", "isCorrect": false },
        { "text": "Parliamentary form of government", "isCorrect": false },
        { "text": "Dual citizenship", "isCorrect": true },
        { "text": "Independent judiciary", "isCorrect": false }
      ],
      "pageNumber": 5
    }
  ],
  "answerKeys": [
    {
      "id": "ak_p10",
      "answers": { "p5_1": "A", "p5_2": "C" },
      "questionRefs": ["p5_1", "p5_2"],
      "pageNumber": 10
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
Assess the question and assign a difficulty level:
- "EASY"   — factual recall, widely known, requires no reasoning
- "MEDIUM" — requires some domain knowledge or light reasoning
- "HARD"   — requires specialist knowledge, multi-step reasoning, or is a common misconception trap

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
 * Returns EXTRACTION_PROMPT optionally prefixed with a special instruction
 * sourced from the book's instructions.json.
 */
export function buildExtractionPrompt(specialInstruction?: string): string {
  if (!specialInstruction) return EXTRACTION_PROMPT;
  return `## Special instruction for this book\n${specialInstruction.trim()}\n\n${EXTRACTION_PROMPT}`;
}

/**
 * Returns ENHANCEMENT_PROMPT optionally prefixed with a special instruction
 * sourced from the book's instructions.json, and with the available categories injected.
 */
export function buildEnhancementPrompt(categories: { slug: string; name: string }[], specialInstruction?: string): string {
  const categoryListStr = categories.map((c) => `- "${c.slug}" (${c.name})`).join('\n');
  const basePrompt = ENHANCEMENT_PROMPT.replace('[AVAILABLE_CATEGORIES_PLACEHOLDER]', `[AVAILABLE CATEGORIES]\n${categoryListStr}`);

  if (!specialInstruction) return basePrompt;
  return `## Special instruction for this book\n${specialInstruction.trim()}\n\n${basePrompt}`;
}
