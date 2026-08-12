# TrivioQ AI Ingestion — Developer Guide

This document explains how the ingestion pipeline works, how to configure it, and how to run it.

---

## Architecture

The ingestion system is a standalone Express HTTP server (`trivioq-worker-ingestion`, port 3014) isolated from the main API. It runs as a separate Docker container and is triggered by the main API via internal HTTP calls — not via BullMQ or Redis.

```
Admin UI → POST /api/v1/admin/ingestion/jobs → ingestion.routes.ts
                                                   ↓ POST /internal/run
                                           trivioq-worker-ingestion (port 3014)
                                                   ↓
                                           IngestionOrchestrator
                                                   ↓
                       ┌───────────────────────────┴────────────────────────┐
                       │                                                     │
              QuestionExtractionProcess                          QuizGenerationProcess
        Scout → Extraction → Enhancement → Upload         Generation → Enhancement → Upload
```

State is persisted to `{jobId}_state.json` on a Docker volume so jobs resume from their last checkpoint after a container restart.

---

## Running Ingestion

Ingestion is managed entirely via the **Admin Portal**:

1. Navigate to **Ingestion → Jobs** in the Admin UI.
2. Select a **Process Type** (`question-extraction` or `quiz-generation`), fill in topic, categories, and any special instructions.
3. Upload the source PDF and click **Start**.
4. The system creates an `IngestionJob` record, transfers the file to the Docker volume, and triggers the worker.
5. Track real-time progress (phase, current page, questions found) and stream logs live in the Admin UI.

---

## Job Configuration (`manifestData`)

When creating a job, the following fields are stored in `IngestionJob.manifestData`:

| Field                               | Type                     | Description                                                                                               |
| :---------------------------------- | :----------------------- | :-------------------------------------------------------------------------------------------------------- |
| `processType`                       | `string`                 | `"question-extraction"` or `"quiz-generation"`                                                            |
| `topic`                             | `string`                 | Fallback topic name used if AI cannot infer one                                                           |
| `categorySlugs`                     | `string[]`               | Category slugs to assign; if omitted the AI selects 1–2 from all available                               |
| `extractionSpecialInstruction`      | `string`                 | Extra instruction prepended to the extraction prompt                                                      |
| `enhancementSpecialInstruction`     | `string`                 | Extra instruction prepended to the enhancement prompt                                                     |
| `classificationSpecialInstruction`  | `string`                 | Extra instruction prepended to the scout/classification prompt                                            |
| `summarizationSpecialInstruction`   | `string`                 | Extra instruction prepended to the summarization prompt (quiz-generation only)                            |
| `pages`                             | `{ from?, to? }`         | Optional page range (1-indexed, inclusive) to restrict processing                                         |
| `modelOverrides`                    | `Record<string, string>` | Per-stage modelId overrides (keys: `scout`, `extraction`, `enhancement`, `summarization`, `generation`)   |

---

## Configuration — AI Providers, Models & Stage Configs

AI ingestion parameters are stored in three database tables managed via the **Admin Portal → AI Config**:

| Table                  | What it stores                                                                                   |
| :--------------------- | :------------------------------------------------------------------------------------------------|
| `AIProvider`           | Provider account: protocol, base URL, encrypted API key, pacing floor (`minCallIntervalMs`)      |
| `AIModel`              | Model row: modelName (sent in the API request), vision/JSON mode flags, default temperature      |
| `IngestionStageConfig` | Per-stage assignment: which model, temperature, call delay, batch size, concurrency              |

### Stages

| Stage           | Process type(s)     | Controls                                       |
| :-------------- | :------------------ | :--------------------------------------------- |
| `scout`         | question-extraction | Page classification (QUESTIONS / OTHER)         |
| `extraction`    | question-extraction | Question + answer-key extraction                |
| `enhancement`   | both                | Hint, explanation, quality score, difficulty    |
| `summarization` | quiz-generation     | Page summarization before generation            |
| `generation`    | quiz-generation     | Question generation from summaries              |

### Stage tuning parameters

| Parameter      | Default     | Description                                             |
| :------------- | :---------- | :------------------------------------------------------ |
| `temperature`  | `0.2`       | LLM temperature for this stage                          |
| `callDelaySec` | `10`        | Seconds to wait between sequential AI calls             |
| `batchSize`    | `null`      | Pages per extraction batch (extraction stage only)      |
| `concurrency`  | `null → 10` | Parallel questions per enhancement batch                |

> **Note:** All of the above replaced the retired `ingestion_*` Setting rows. If you see keys like `ingestion_scout_provider` or `ingestion_extraction_batch_size` in an old DB, they are safe to delete — they are no longer read.

---

## Seeding

After running the `add_ai_provider_model_stageconfig` migration, seed the AI tables:

```bash
pnpm --filter @trivioq/database seed:ai-providers
```

This upserts the 5 default providers, their models, and all 5 stage configs. Re-running is safe (idempotent). API keys are read from env vars at seed time — if an env var is not set, the existing cipher in the DB is preserved.
