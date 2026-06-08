# TrivioQ Ingestion Guide

This folder contains the books and documents queued for the AI-powered trivia question ingestion pipeline.

## Directory Structure

To ingest a new book or document:
1. Create a sub-folder under this `ingestion/` directory (e.g., `sample-book/`).
2. Place your source PDF file inside that sub-folder. (Only one PDF per folder is processed; if multiple are present, only the first is selected).
3. Place an `instructions.json` file inside that sub-folder.

Your sub-folder structure should look like this:
```
ingestion/
└── sample-book/
    ├── instructions.json
    └── your-book-file.pdf
```

---

## Instructions Configuration (`instructions.json`)

Each book folder requires an `instructions.json` file to define metadata and optional fallback settings. Here is the configuration format:

```json
{
  "bookId": "sample-trivia-book",
  "specialInstruction": "Extract only standard multiple choice questions with 4 choices. Ignore introductory and summary text.",
  "providers": {
    "scout": "google",
    "extraction": "google",
    "enhancement": "google"
  }
}
```

### Fields Description

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `bookId` | `string` | **Yes** | A unique, URL-friendly slug/identifier for this book (e.g. `world-history-vol1`). This is used to prefix the state management files. |
| `topic` | `string` | No | The fallback topic name. If omitted, the topic is automatically detected by the AI during the enhancement phase, falling back to "General" if undetected. |
| `categorySlugs` | `string[]` | No | An array of category slugs. If omitted, the pipeline retrieves all available categories from the database, and the AI selects the 1–2 most relevant categories during the enhancement phase. |
| `specialInstruction` | `string` | No | Free-text prompt injected to guide the AI during the extraction and enhancement phases. Use this to focus on specific chapters, style requirements, or details to ignore. |
| `providers` | `object` | No | Per-phase overrides for the AI model provider. Allowed values: `"google"` or `"nvidia"`. |

---

## How to Run Ingestion

Once you have added the PDF files and `instructions.json` configuration, run the following command to start the ingestion process:

### From the Workspace Root:
```bash
yarn workspace api ingest
```

### Or from within the `apps/api` directory:
```bash
yarn ingest
```

### Environment Variables (Optional)
You can configure global fallbacks using environment variables:
- `INGESTION_AI_PROVIDER`: The default AI provider (`google` or `nvidia`).
- `INGESTION_DIR`: The path to the ingestion directory (defaults to `ingestion` relative to the running directory).
