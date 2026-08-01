# Global Project Rules

## Localization Requirement

All text values, messages, labels, or content that are displayed to users in the UI MUST be localized.
Do not hardcode raw English strings in React components or any user-facing code. Instead, use the appropriate internationalization hook (e.g., `useTranslations` from `next-intl`) and add the translations to the corresponding JSON locale files (e.g., `messages/en.json`).

## UI Interaction Rules

Never use native `window.confirm` or `alert()` for user interactions.
Instead, use the custom UI components provided by the app (e.g., `ConfirmProvider`/`useConfirm` hook for confirmations, and a notification/toast system like `sonner` for alerts).

## File Naming Convention

All new filenames MUST be lowercase and use hyphens (`-`) for multiple words (e.g., `user-profile.tsx`). Exceptions are allowed only where mandatory by frameworks or conventions (e.g., `README.md`, `.env`, `layout.tsx`, `page.tsx`).
