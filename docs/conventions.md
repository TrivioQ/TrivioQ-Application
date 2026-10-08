# Repository Conventions

These come from [`.agents/AGENTS.md`](../.agents/AGENTS.md) (global project rules) plus the tooling configuration. Follow them for every change.

## Rules

1. **Localization is mandatory.** No hard-coded user-facing English in components. Use `useTranslations` (`next-intl`) in web/admin and `useTranslation` (i18n) in mobile, and add keys to the locale JSON (`apps/web/messages/en.json`, `apps/admin/messages/en.json`, `apps/mobile/src/i18n/en.json`).
2. **No native dialogs.** Never use `window.confirm` / `alert()`. Use the app's `ConfirmProvider` / `useConfirm` (or `confirm-modal` components) for confirmations and `sonner` toasts (`sonner-native` on mobile) for alerts.
3. **File naming:** lowercase, hyphen-separated (`user-profile.tsx`). Exceptions only where a framework requires it (`README.md`, `page.tsx`, `layout.tsx`, `route.ts`, `.env`, …). Some older files (e.g. `Preferences.tsx`, `FriendCard.tsx`, `ThemeContext.tsx`) predate the rule.
4. **Responsive:** every UI must work on desktop, tablet and mobile widths.
5. **Theming:** light and dark mode must both be supported.
6. **DRY:** when touching a file, remove duplication (extract helpers/components, map over arrays).

## Tooling

| Tool | Config | Notes |
| :-- | :-- | :-- |
| ESLint 9+ flat config | `eslint.config.js` (root), per-app configs | `pnpm lint`, `pnpm lint:fix` |
| Prettier | `.prettierrc`, `.prettierignore` | `pnpm format` |
| TypeScript | per-package `tsconfig.json` | Pre-commit runs `tsc --noEmit` across workspaces except `shared-types` |
| Husky | `.husky/pre-commit` | Runs `prisma migrate status` → lint → type check |
| Turborepo | `turbo.json` | Tasks: `build`, `test`, `lint`, `dev` (persistent, uncached), `clean`, `ingest` |
| VS Code | `.vscode/` | Format and `eslint --fix` on save; shared launch configs and recommended extensions |

## Workspace layout

```
apps/        api · admin · web · mobile
packages/    database · shared-types
docs/        this documentation
scripts/     deploy.sh (Docker helper)
```

pnpm workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`); `@types/react` is pinned to 18.2.79 via `pnpm.overrides`.

## Database changes

Edit `schema.prisma`, then run `pnpm --filter @trivioq/database db-migrate` and commit the generated migration. The pre-commit hook blocks un-migrated schema changes.
