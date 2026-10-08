# Question Moderation

New questions never go live directly from AI. They pass through the `PendingQuestion` staging table and a human review.

## Status flow

```
              ingestion upload
                    │
   ┌────────────────┼──────────────────┐
   ▼                                   ▼
PENDING                       PENDING-DUPLICATE  (matches a live Question, replacesQuestionId set)
   │ daily AI validation (10:00 UTC)
   ├──▶ AI-APPROVED ─┐
   └──▶ AI-REJECTED ─┤──▶ admin: Approve ▶ APPROVED (question created / replaced)
         ▲  requeue  │         admin: Reject  ▶ REJECTED
         └───────────┘
```

| Status | Meaning |
| :-- | :-- |
| `PENDING` | Awaiting AI validation (shown as "Unvalidated") |
| `AI-APPROVED` / `AI-REJECTED` | Verdict of the AI validator, with `aiFeedback` |
| `PENDING-DUPLICATE` | Similar to a live question; approval replaces that question |
| `APPROVED` / `REJECTED` | Final admin decision. `rejectionReason` optional |

`PendingQuestion` rows are **never deleted** — approval and rejection only change `status` (a Postgres trigger from the `prevent_pending_question_deletes` migration blocks `DELETE`/`TRUNCATE` unless a session bypass variable is set), which preserves history and prevents re-ingesting the same content.

## AI validation

`services/question-validation-service.ts`, triggered by the *AI Question Validation* cron (daily 10:00 UTC) or manually from **Admin → Cron Jobs**:

- Loads `PENDING` questions and validates them in chunks (`concurrency`, default 10) with the model configured on the `enhancement` stage, honouring its delay and temperature.
- The prompt (`buildValidationPrompt(targetAgeRating)`) covers fact-check, validity and completeness.
- Result → `AI-APPROVED` or `AI-REJECTED` + feedback summary.

## Admin review UI

**Admin → Review Questions** (`/questions/review`) provides:

- Filters by status (counts for unvalidated, AI-validated, AI-rejected, duplicates, rejected), search and pagination.
- A review panel with an editor (question text in Markdown/KaTeX, choices and correct answer, hint, explanation, difficulty, categories, age rating) and the AI feedback and quality score.
- Actions: **Approve** (with edits), **Reject** (optional reason), **Re-queue** AI-rejected items back to `PENDING`, and bulk approve/reject/re-queue.

Implemented as server actions in `apps/admin/src/app/actions/pending-questions.ts`. On approval:

- normal item → creates a `Question` with its `Choice` rows and category links;
- `PENDING-DUPLICATE` with `replacesQuestionId` → updates/replaces the live question in place;
- the pending row is marked `APPROVED`.

## Managing live questions

**Admin → Questions** (`/questions`) is the CRUD table for published questions: filter by category/difficulty/age rating, create, edit, delete (choices cascade). Dashboard charts show difficulty and category distribution.

Related: [AI ingestion](ai-ingestion.md), [Cron jobs](../api/cron-jobs.md).
