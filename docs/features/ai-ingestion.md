# AI Question Ingestion

Turns source PDFs (question books, study material) into reviewable `PendingQuestion` rows. Code: `apps/api/src/ai-question-ingestion/`; worker: `apps/api/src/workers/ingestion-worker.ts`; UI: **Admin → Ingestion**. A shorter developer guide also lives next to the code in [`apps/api/src/ai-question-ingestion/README.md`](../../apps/api/src/ai-question-ingestion/README.md).

## Architecture

```
Admin UI ── chunked upload ──▶ POST /v1/admin/ingestion/upload-chunk  (× N)
         ── finalize ───────▶ POST /v1/admin/ingestion/jobs/finalize  → IngestionJob (QUEUED)
API ── POST /internal/run ──▶ worker-ingestion (:3014)
                                 ├─ PDF → page images (pdf-to-image, optional auto-orientation via Tesseract)
                                 └─ IngestionOrchestrator
                                       ├─ QuestionExtractionProcess  (existing question books)
                                       └─ QuizGenerationProcess      (generate from facts)
```

The worker is a separate HTTP service, not a BullMQ consumer, because jobs can run for days. State is checkpointed to `{jobId}_state.json` on a Docker volume and mirrored to the database with retry. See [Workers & queues](../api/workers-and-queues.md#ingestion-worker-standalone-http-server) for the resilience design (heartbeat every 30 s, pending-sync file, startup recovery).

Large PDFs are uploaded in chunks stored under a temp directory keyed by `uploadId`, then assembled on finalize and moved to the ingestion volume.

## Process types

### `question-extraction`

For documents that already contain questions.

| Phase | Stage config | What happens |
| :-- | :-- | :-- |
| 1. **Scout** | `scout` | Each page image is classified: `QUESTIONS`, `QUESTIONS_WITH_KEYS` (separate answer-key table), `QUESTIONS_WITH_KEY_UNDERNEATH` ("Answer: C" printed under the question), or `OTHER` (skipped) |
| 2. **Extraction** | `extraction` | Questions and options are extracted as GitHub-flavoured Markdown (math supported); answer keys are extracted separately and reconciled with questions, including keys that appear pages later. Questions waiting for a key are held as `AWAITING_KEY` |
| 3. **Enhancement** | `enhancement` | For each question: hint, explanation, quality score (0–100), difficulty, topic, 1–3 category slugs, age rating, factual-correctness check. Runs with configurable concurrency |
| 4. **Upload** | — | Writes to `PendingQuestion` with de-duplication (below) |

### `quiz-generation`

For narrative/educational documents.

| Phase | Stage config | What happens |
| :-- | :-- | :-- |
| 1. **Summarization + Generation** | `summarization`, `generation` | Extract up to 15 standalone facts per page, then write multiple-choice questions from them |
| 2. **Enhancement** | `enhancement` | Same as above |
| 3. **Upload** | — | Same as above |

Per-question state machine in the checkpoint file: `AWAITING_KEY → READY_FOR_ENHANCEMENT → READY_FOR_UPLOAD → UPLOADED`.

## Duplicate handling at upload

1. **Against `PendingQuestion`** (`checkPendingDuplicate`): if a near-duplicate exists, the higher `aiQualityScore` wins. A better new version overwrites the existing row and resets it to `PENDING`; otherwise the new one is dropped.
2. **Against live `Question`s** (`checkIsDuplicate`): `pg_trgm` `similarity() > 0.85`. A match becomes a `PENDING-DUPLICATE` row with `replacesQuestionId` pointing at the live question, so approving it replaces the old one.
3. Otherwise a normal `PENDING` row is inserted.

Choices are shuffled before saving; difficulty and age rating returned by the model are sanitised (`MEDIUM` and `ALL` as safe defaults).

## Running a job

1. **Admin → Ingestion → New job.**
2. Choose process type, topic, categories (if none, the AI picks 1–2), optional page range, special instructions per prompt, and optional per-stage model overrides.
3. Upload the PDF and start. Track phase, page, questions found/uploaded and live logs (SSE `GET /jobs/:id/logs`); download the job artifact; **pause**, **retry** or **delete** jobs.
4. Review the output in **Admin → Review Questions** ([Question moderation](question-moderation.md)).

### Job configuration (`IngestionJob.manifestData`)

| Field | Description |
| :-- | :-- |
| `processType` | `question-extraction` or `quiz-generation` |
| `topic` | Fallback topic if the AI can't infer one |
| `categorySlugs` | Categories to assign; AI chooses when omitted |
| `extractionSpecialInstruction` / `enhancementSpecialInstruction` / `classificationSpecialInstruction` / `summarizationSpecialInstruction` | Extra text prepended to that stage's prompt |
| `pages` | `{ from?, to? }` 1-indexed inclusive page range |
| `modelOverrides` | Per-stage model id overrides (`scout`, `extraction`, `enhancement`, `summarization`, `generation`) |

## AI configuration (DB-driven)

Managed in **Admin → AI Providers / AI Models / Ingestion Settings** — no redeploy needed.

| Table | Contents |
| :-- | :-- |
| `AIProvider` | Protocol (`openai`, `gemini`, `anthropic` *(stub)*, `local_form`), `baseUrl`, **encrypted** API key, default headers, `minCallIntervalMs` pacing |
| `AIModel` | `modelName` sent to the API, vision/JSON-mode flags, default temperature, context window, max output, `extraParams` |
| `IngestionStageConfig` | Per stage: model, `temperature` (default 0.2), `callDelaySec` (10), `batchSize` (extraction pages per batch), `concurrency` (enhancement, default 10), `specialInstruction`, `isActive` |

Adapters: OpenAI-compatible (OpenAI, NVIDIA NIM, DeepSeek, Omnirouter), Gemini native SDK, local multipart-form endpoints. The registry (`providers/registry.ts`) resolves a model id to a ready provider, decrypts the key, and caches the instance briefly.

Seeding: `pnpm --filter @trivioq/database seed-ai-providers` upserts the five default providers (`google`, `nvidia`, `deepseek`, `omnirouter`, `local`), their models and the five stage configs. Idempotent; an unset env key preserves the stored cipher. Requires `ENCRYPTION_MASTER_KEY`.

The AI validator cron reuses the `enhancement` stage's model, delay, temperature and concurrency.

## Troubleshooting

- *"IngestionStageConfig … has no modelId assigned"* — assign a model to that stage in Ingestion Settings.
- *"Failed to decrypt API key"* — `ENCRYPTION_MASTER_KEY` changed; re-enter the provider key in the admin UI.
- *Job stuck in PROCESSING* — check `lastHeartbeatAt`; restarting the worker re-triggers `PROCESSING` jobs from their checkpoint.
- Old `ingestion_*` `Setting` rows are no longer read and can be deleted.
