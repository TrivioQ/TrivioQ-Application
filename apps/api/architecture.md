# TrivioQ API (`apps/api`)

The API app is the core backend service that powers the entire TrivioQ platform. It serves RESTful endpoints and manages background processing tasks.

## Technical Stack

- **Framework:** Express.js (Node.js)
- **Job Queues:** BullMQ (backed by Redis) with `@bull-board` for queue monitoring.
- **Key Dependencies:** `@google/genai` (AI processing), `@sendgrid/mail` (emails), `node-cron` (scheduling), Firebase Admin, PDF processing utilities (`pdf2pic`).

## Key Functionalities

### REST Endpoints (`src/routes`)
- `admin`: Endpoints for the admin dashboard.
- `auth`: User authentication and session management.
- `drop`: Logic for fetching and managing trivia "drops" (game sessions).
- `faq`: Retrieval of FAQs.
- `leaderboard`: Fetching rankings.
- `legal`: Serving privacy policy and terms.
- `notifications`: Endpoint for user notification registration and fetching.
- `subscription`: Managing user subscriptions.
- `user`: User profile management.
- `queues`: Dashboard for monitoring BullMQ jobs.

### Background Workers (`src/workers`)
- **AI Question Worker:** Ingests raw content (like PDFs), processes it, and generates trivia questions using Google Gemini AI.
- **Dispatcher:** Manages the routing of background tasks to specific queues.
- **Drop Worker:** Handles the state and lifecycle of active trivia drops.
- **Email Worker:** Asynchronously sends transactional emails (via SendGrid).
- **Leaderboard Worker:** Periodically calculates and updates user rankings and scores.
- **Notification Worker:** Handles the dispatch of push notifications to mobile and web clients.
- **Scheduler:** Runs cron jobs to trigger drops and other recurring events.
