// ── Prompts ───────────────────────────────────────────────────────────────────
// All AI prompts live here so every provider imports from one place.
// Changes to a prompt are automatically reflected in all providers.

export const SCOUT_PROMPT = `You are a document classifier. Analyze the provided page image and classify it into one of these categories:
- "QUESTIONS" — contains trivia or quiz questions
- "ANSWER_KEY" — contains answers or answer keys for questions
- "OTHER" — anything else (table of contents, blank pages, etc.)

Return ONLY a JSON object with this exact schema. Do not include markdown, explanations, or any other text:
{"classification": "QUESTIONS|ANSWER_KEY|OTHER", "confidence": 0.0-1.0}`;

export const EXTRACTION_PROMPT = `You are an expert trivia question extractor. Given images containing trivia questions (and possibly their answer keys), extract all questions with their multiple-choice options.

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

export const ENHANCEMENT_PROMPT = `You are a trivia question enhancer. Given a trivia question with its choices (which may already contain Markdown, LaTeX math, or tables), generate a hint, an explanation, and an AI quality score.

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
