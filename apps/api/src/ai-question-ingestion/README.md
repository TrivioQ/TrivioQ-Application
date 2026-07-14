# TrivioQ Ingestion Guide

This folder contains the books and documents queued for the AI-powered trivia question ingestion pipeline.

## Directory Structure

To ingest a new book or document:

1. Create a sub-folder under this `ingestion/` directory (e.g., `sample-book/`).
2. Place your source PDF file inside that sub-folder. (Only one PDF per folder is processed; if multiple are present, only the first is selected).
3. Place an `manifest.json` file inside that sub-folder.

Your sub-folder structure should look like this:

```
ingestion/
└── sample-book/
    ├── manifest.json
    └── your-book-file.pdf
```

---

## Instructions Configuration (`manifest.json`)

Each book folder requires an `manifest.json` file to define metadata and optional per-phase AI instructions. Here is a full configuration example:

```json
{
  "bookId": "sample-trivia-book",
  "topic": "Indian History",
  "categorySlugs": ["history", "geography"],
  "extractionSpecialInstruction": "Extract only standard multiple choice questions with 4 choices. Ignore introductory and summary text. Strip any competitive exam year markers (e.g. [1995], [2020-I]) from the end of questions.",
  "enhancementSpecialInstruction": "This book contains Indian competitive exam questions. Prioritise accuracy and historical context in hints and explanations.",
  "providers": {
    "scout": "nvidia",
    "extraction": "nvidia",
    "enhancement": "nvidia"
  }
}
```

### Fields Description

| Field                           | Type       | Required | Description                                                                                                                                                                                                                   |
| :------------------------------ | :--------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookId`                        | `string`   | **Yes**  | A unique, URL-friendly slug/identifier for this book (e.g. `world-history-vol1`). Used as the prefix for state management files.                                                                                              |
| `topic`                         | `string`   | No       | The fallback topic name. If omitted, the topic is auto-detected by the AI during enhancement, falling back to `"General"` if undetected.                                                                                      |
| `categorySlugs`                 | `string[]` | No       | An array of category slugs. If omitted, all available categories are fetched from the database and the AI selects the 1–2 most relevant ones.                                                                                 |
| `extractionSpecialInstruction`  | `string`   | No       | Free-text instruction prepended to the **extraction** prompt only. Use this to control what gets extracted — e.g. focus on specific question types, strip unwanted markers, or ignore certain pages.                          |
| `enhancementSpecialInstruction` | `string`   | No       | Free-text instruction prepended to the **enhancement** prompt only. Use this to tailor hint/explanation style, fact-check context, or domain-specific guidance.                                                               |
| `providers`                     | `object`   | No       | Per-phase overrides for the AI model provider. Allowed values: `"google"`, `"nvidia"`, `"deepseek"`. Each key (`scout`, `extraction`, `enhancement`) falls back to the env var overrides and then to `INGESTION_AI_PROVIDER`. |

---

## How to Run Ingestion

Once you have added the PDF files and `manifest.json` configuration, run the following command to start the ingestion process:

### From the Workspace Root:

```bash
pnpm --filter api ingest
```

### Or from within the `apps/api` directory:

```bash
pnpm ingest
```

---

## Environment Variables

All variables are set in `apps/api/.env`. They act as global defaults that `manifest.json` fields take precedence over.

### Providers & Models

| Variable                         | Default                  | Description                                                                   |
| :------------------------------- | :----------------------- | :---------------------------------------------------------------------------- |
| `INGESTION_AI_PROVIDER`          | `google`                 | Global fallback provider for all phases (`google` \| `nvidia` \| `deepseek`). |
| `INGESTION_SCOUT_PROVIDER`       | _(falls back to global)_ | Provider override for the Scout (classification) phase.                       |
| `INGESTION_EXTRACTION_PROVIDER`  | _(falls back to global)_ | Provider override for the Extraction phase.                                   |
| `INGESTION_ENHANCEMENT_PROVIDER` | _(falls back to global)_ | Provider override for the Enhancement phase.                                  |
| `INGESTION_SCOUT_MODEL`          | _(provider default)_     | Model name override for the Scout phase.                                      |
| `INGESTION_EXTRACTION_MODEL`     | _(provider default)_     | Model name override for the Extraction phase.                                 |
| `INGESTION_ENHANCEMENT_MODEL`    | _(provider default)_     | Model name override for the Enhancement phase.                                |

### Tuning

| Variable                               | Default     | Description                                                                              |
| :------------------------------------- | :---------- | :--------------------------------------------------------------------------------------- |
| `INGESTION_DIR`                        | `ingestion` | Path to the ingestion directory, relative to `apps/api/`.                                |
| `INGESTION_EXTRACTION_BATCH_SIZE`      | `1`         | Number of page images sent to the AI in a single extraction call.                        |
| `INGESTION_SCOUT_CALL_DELAY_SEC`       | `10`        | Seconds to wait between Scout phase AI calls.                                            |
| `INGESTION_EXTRACTION_CALL_DELAY_SEC`  | `10`        | Seconds to wait between Extraction phase AI calls.                                       |
| `INGESTION_ENHANCEMENT_CALL_DELAY_SEC` | `10`        | Seconds to wait between Enhancement phase AI calls.                                      |
| `INGESTION_SCOUT_TEMPERATURE`          | `0.2`       | Temperature for the Scout phase.                                                         |
| `INGESTION_EXTRACTION_TEMPERATURE`     | `0.2`       | Temperature for the Extraction phase. Lower values = more deterministic output.          |
| `INGESTION_ENHANCEMENT_TEMPERATURE`    | `1.0`       | Temperature for the Enhancement phase. Higher values = more creative hints/explanations. |
