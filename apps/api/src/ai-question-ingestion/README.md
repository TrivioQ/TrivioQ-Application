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
  "enhancementSpecialInstruction": "This book contains Indian competitive exam questions. Prioritise accuracy and historical context in hints and explanations."
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

---

## How to Run Ingestion

Ingestion is no longer run via CLI scripts. The entire process is now managed via the **Admin Portal**:

1. Upload the PDF and `manifest.json` in the **Books** section of the Admin UI.
2. The system creates an `IngestionJob` in the database.
3. The `ingestion-worker` automatically picks up the job from the `pdf-ingestion` BullMQ queue.
4. You can track the progress of the ingestion phases (Scout, Extraction, Enhancement, Summarization, Generation) in real-time on the Admin UI.

---

## Configuration Settings

AI ingestion parameters are now managed globally in the database via the **Admin Portal** UI instead of `.env` files.

### Providers & Models

You can configure the AI Provider and Model for each specific phase:
- **Providers Supported**: Google (Gemini), Nvidia, DeepSeek.
- **Models**: Configurable per phase (e.g. `gemini-1.5-pro` for extraction, `gemini-1.5-flash` for summarization).
- **Fallback Behavior**: If a specific phase provider/model is not set, the system will use the default values configured during database seeding.

### Tuning

The following tuning parameters can be adjusted from the **App Settings** section in the Admin UI:

| Setting                                | Description                                                                              |
| :------------------------------------- | :--------------------------------------------------------------------------------------- |
| `ingestion_extraction_batch_size`      | Number of page images sent to the AI in a single extraction call.                        |
| `ingestion_*_call_delay_sec`           | Seconds to wait between AI calls for a specific phase (rate limiting).                   |
| `ingestion_*_temperature`              | Temperature for a specific phase (e.g., lower for extraction, higher for enhancement).   |
| `ingestion_enhancement_concurrency`    | Number of questions to enhance in parallel.                                              |

> **Note**: The base API keys (e.g. `GEMINI_API_KEY`, `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`) still reside securely in `apps/api/.env` and are not exposed in the database or UI.
