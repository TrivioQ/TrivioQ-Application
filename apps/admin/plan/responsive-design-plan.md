# TrivioQ Admin App — Responsive Design Plan

> **Author:** Senior UI Developer
> **Scope:** `apps/admin` (Next.js 14, Tailwind CSS v4, shadcn/ui, Lucide Icons)
> **Goal:** Make every admin page fully usable from tablet (768px) upwards, while ensuring desktop (1024px+) remains the primary experience.

---

## 1. Executive Summary

The `apps/admin` codebase has a **fundamentally broken responsive design**. The root cause is architectural: the layout uses a **fixed-width `w-64` sidebar** placed in a `flex h-screen overflow-hidden` root. This sidebar is **always visible and never collapses**, consuming 256px of any viewport. On screens narrower than ~900px the main content is too narrow to be usable.

Beyond the root layout issue, the admin app has **9 pages** and **multiple table components** all using `<Table>` with 4-8 columns and no horizontal scroll wrappers. Every table will overflow on any device narrower than a full desktop.

This plan documents **18 distinct responsive issues** with exact line-number references and code-level fix strategies.

---

## 2. Breakpoint Strategy for Admin

| Breakpoint | Min Width | Admin Target |
|------------|-----------|--------------|
| (default) | 0px | N/A (Admin not designed for phones) |
| `md` | 768px | Tablets — sidebar collapses to overlay |
| `lg` | 1024px | Small laptops — minimum full-layout target |
| `xl` | 1280px | Standard desktop — primary design target |
| `2xl` | 1536px | Large monitors |

---

## 3. Root Architecture Issue

### 3.1 Admin Layout (`src/app/[locale]/(admin)/layout.tsx`)

**Current State: CRITICAL — Architecturally Broken**

The layout is:
```tsx
// Line 14
<div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
  <aside className="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
  <main className="flex-1 overflow-y-auto p-8 bg-gray-100/50">
    <div className="max-w-6xl mx-auto">{children}</div>
  </main>
</div>
```

| # | Issue | Line | Severity |
|---|-------|------|----------|
| LAY1 | Sidebar `w-64` is fixed with no collapse mechanism. On 768-1023px tablets, content area is only ~384px after padding. | Line 16 | Critical |
| LAY2 | No mobile/tablet hamburger menu or sidebar toggle. | Lines 14-72 | Critical |
| LAY3 | `main` has `p-8` at all sizes. On tablet content is 448px - 64px padding = ~384px. | Line 75 | High |
| LAY4 | Sidebar nav items have no title/tooltip for icon-only mode. | Lines 21-60 | Medium |

**Fix Strategy — Collapsible Sidebar:**

```tsx
// Upgrade layout.tsx to 'use client' component
const [sidebarOpen, setSidebarOpen] = useState(false);

<div className="flex h-screen overflow-hidden bg-gray-50">
  {/* Mobile overlay */}
  {sidebarOpen && (
    <div className="fixed inset-0 z-20 bg-black/50 lg:hidden"
      onClick={() => setSidebarOpen(false)} />
  )}

  {/* Sidebar — slides in on tablet, always visible on lg+ */}
  <aside className={cn(
    "fixed lg:relative z-30 lg:z-auto",
    "w-64 h-full bg-gray-900 text-white flex flex-col flex-shrink-0",
    "transition-transform duration-200",
    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
  )}>
    {/* existing nav content */}
  </aside>

  <main className="flex-1 flex flex-col overflow-hidden">
    {/* Mobile topbar */}
    <div className="lg:hidden flex items-center px-4 h-14 border-b border-gray-200 bg-white">
      <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <span className="ml-3 font-bold text-gray-900">TrivioQ Admin</span>
    </div>

    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-100/50">
      <div className="max-w-6xl mx-auto">{children}</div>
    </div>
  </main>
</div>
```

---

## 4. Page-by-Page Audit

### 4.1 Dashboard Page (`src/app/[locale]/(admin)/page.tsx`)

**Current State: Mostly Responsive**

| # | Issue | Line | Severity |
|---|-------|------|----------|
| DB1 | Metric Cards: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. On `lg` (1024px content ~816px) there is no `lg:grid-cols-4`. Add it. | Line 74 | Medium |

```tsx
// Fix DB1
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
```

---

### 4.2 Questions Page (`src/app/[locale]/(admin)/questions/page.tsx`)

| # | Issue | Line | Severity |
|---|-------|------|----------|
| QP1 | Page header `flex justify-between items-start` — "Create Question" button overflows on narrow content. Add `flex-wrap gap-4`. | Line 46 | Medium |
| QP2 | Filter bar SearchInput `w-64` fixed width — too wide on narrow content. Use `w-full sm:w-64`. | filter-bar line 76 | Medium |

```tsx
// Fix QP1
<div className="flex flex-wrap justify-between items-start gap-4">

// Fix QP2
<SearchInput ... className="w-full sm:w-64 h-9" />
```

---

### 4.3 Questions Data Table (`src/components/questions/questions-data-table.tsx`)

| # | Issue | Line | Severity |
|---|-------|------|----------|
| QDT1 | `<Table>` has no `overflow-x-auto` wrapper. 5 columns including `max-w-[400px]` question text will overflow. | Line 38 | Critical |
| QDT2 | `max-w-[400px]` question text column alone is 400px wide. | columns.tsx line 68 | Critical |
| QDT3 | Pagination row `flex items-center justify-between` — can overflow on narrow widths. Add `flex-wrap gap-4`. | Line 69 | Medium |

```tsx
// Fix QDT1
<div className={`overflow-x-auto rounded-md border bg-white ...`}>
  <Table className="min-w-[600px]">

// Fix QDT2
<div className="max-w-[200px] sm:max-w-[300px] lg:max-w-[400px] truncate" title={text}>

// Fix QDT3
<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
```

---

### 4.4 Content Review Panel (`src/app/[locale]/(admin)/questions/review/content-review-panel.tsx`)

**Current State: CRITICAL — Two-pane layout broken on tablet**

| # | Issue | Line | Severity |
|---|-------|------|----------|
| CR1 | Two-pane `flex gap-0` with fixed `w-80` left panel. On tablet content (~448px) editor gets only 128px — unusable. | Line 203 | Critical |
| CR3 | `h-[calc(100vh-220px)] min-h-[600px]` breaks when mobile topbar adds 56px. | Line 203 | High |
| CR4 | ReviewEditor header has up to 4 action buttons that overflow on narrow right pane. | review-editor.tsx line 170 | High |
| CR5 | `grid grid-cols-2 gap-4` for Difficulty + Age Rating — too narrow on small right pane. | review-editor.tsx line 254 | Medium |

```tsx
// Fix CR1 + CR3: Stack panes on tablet
<div className="flex flex-col lg:flex-row border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden
  h-auto lg:h-[calc(100vh-220px)] min-h-[400px] lg:min-h-[600px]">

  <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/50 flex flex-col h-64 lg:h-auto">
  </aside>

  <main className="flex-1 flex flex-col min-h-[300px] lg:min-h-0">
  </main>
</div>

// Fix CR4: Wrap action buttons
<div className="flex flex-wrap items-center gap-2 shrink-0">

// Fix CR5: Single column on mobile
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

---

### 4.5 Users Page + DataTable (`src/components/users-table/data-table.tsx`)

**DataTable is shared by 6+ pages — highest-leverage fix**

| # | Issue | Line | Severity |
|---|-------|------|----------|
| UP1 | 7-column `<Table>` (username, email, tier, score, streak, last login, actions) with no `overflow-x-auto`. | data-table.tsx line 59 | Critical |
| UP2 | SearchInput `w-64` fixed width — use `w-full sm:w-64`. | data-table.tsx line 53 | Medium |

```tsx
// Fix UP1 (shared DataTable — fixes Users, Categories, FAQs, Subscription History, Bonus Plans)
<div className={`overflow-x-auto rounded-md border bg-white ...`}>
  <Table className="min-w-[600px]">

// Fix UP2
<SearchInput ... className="w-full sm:w-64" />
```

---

### 4.6 Notifications Page (`src/app/[locale]/(admin)/notifications/page.tsx`)

| # | Issue | Line | Severity |
|---|-------|------|----------|
| NP1 | Header `flex items-center justify-between` — "Templates" link + "Create" button overflow beside icon+title on tablet. | Line 22 | High |
| NP3 | `NotificationList` renders 8-column `<Table>` with no `overflow-x-auto`. | notification-list.tsx line 141 | Critical |
| NP4 | Long badge text (e.g., "SUBSCRIPTION_REMINDER") overflows badge width. | notification-list.tsx line 158 | Medium |

```tsx
// Fix NP1
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

// Fix NP3
<div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
  <Table className="min-w-[700px]">

// Fix NP4 — hide low-priority columns on tablet
<TableHead className="hidden lg:table-cell">Audience</TableHead>
<TableCell className="hidden lg:table-cell">...</TableCell>
```

---

### 4.7 App Settings Page (`src/app/[locale]/(admin)/app-settings/settings-editor.tsx`)

| # | Issue | Line | Severity |
|---|-------|------|----------|
| AS1 | Raw `<table>` with `overflow-hidden` wrapper — no `overflow-x-auto`. 4 columns with `px-6` padding each will overflow. | Lines 120-141 | Critical |
| AS3 | Edit state input `w-32` + 2 icon buttons can overflow on narrow content. Make input `w-full sm:w-32`. | Line 59 | Medium |
| AS4 | "Last Updated" column can be hidden on mobile: `hidden md:table-cell`. | Lines 77-80 | Low |

```tsx
// Fix AS1
<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
  <table className="w-full min-w-[480px] text-sm">

// Fix AS3
<input ... className="w-full sm:w-32 rounded-md border ..." />

// Fix AS4
<th className="hidden md:table-cell py-3 px-6">Last Updated</th>
<td className="hidden md:table-cell py-4 px-6 ...">
```

---

### 4.8 Template List (`src/components/template-list.tsx`)

| # | Issue | Severity |
|---|-------|----------|
| TL1 | 8-column table with no `overflow-x-auto`. | Critical |
| TL3 | Hide "Variables" and "Created" columns on tablet: `hidden lg:table-cell`. | Medium |

```tsx
// Fix TL1
<div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
  <Table className="min-w-[800px]">

// Fix TL3
<TableHead className="hidden lg:table-cell">Variables</TableHead>
<TableCell className="hidden lg:table-cell">...</TableCell>
```

---

## 5. Implementation Priority Matrix

| Priority | Issue(s) | Components | Impact |
|----------|----------|------------|--------|
| P1 Critical | LAY1, LAY2 | `layout.tsx` | Entire app unusable on tablets |
| P1 Critical | CR1 | `content-review-panel.tsx` | Two-pane editor broken |
| P1 Critical | QDT1, UP1, NP3, AS1, TL1 | All table components | All tables overflow |
| P2 High | LAY3, NP1, CR4 | layout, notifications, review-editor | Padding and button overflow |
| P3 Medium | DB1, QP1, QP2, QDT2, CR5, AS3 | Various | Grid and input improvements |
| P4 Low | LAY4, AS4, TL3 | Various | Column hiding polish |

---

## 6. File-by-File Change Summary

| File | Lines to Modify | Changes |
|------|-----------------|---------|
| `src/app/[locale]/(admin)/layout.tsx` | 14-83 | Collapsible sidebar + mobile topbar + `p-4 lg:p-8` |
| `src/components/users-table/data-table.tsx` | 53, 59 | overflow-x-auto + min-w + SearchInput responsive width |
| `src/components/questions/questions-data-table.tsx` | 38 | overflow-x-auto + min-w |
| `src/components/notification-list.tsx` | 141-151 | overflow-x-auto + hide cols on tablet |
| `src/components/template-list.tsx` | 132-143 | overflow-x-auto + hide cols on tablet |
| `src/app/[locale]/(admin)/app-settings/settings-editor.tsx` | 59, 120-128 | overflow-x-auto + edit input width + hide col |
| `src/app/[locale]/(admin)/questions/review/content-review-panel.tsx` | 203-205 | flex-col lg:flex-row stacked layout |
| `src/app/[locale]/(admin)/questions/review/review-editor.tsx` | 170, 254 | Button wrap + grid single-col fallback |
| `src/app/[locale]/(admin)/notifications/page.tsx` | 22 | Header flex-col sm:flex-row |
| `src/app/[locale]/(admin)/questions/page.tsx` | 46 | Header flex-wrap |
| `src/app/[locale]/(admin)/page.tsx` | 74 | lg:grid-cols-4 metric cards |
| `src/components/questions/columns.tsx` | 68 | Responsive max-w truncation |

---

## 7. Testing Checklist

### Devices to Test
- [ ] iPad (768x1024) — portrait
- [ ] iPad (1024x768) — landscape
- [ ] iPad Pro 11" (834x1194)
- [ ] MacBook Air 13" (1280x800)
- [ ] MacBook Pro 14" (1512x982)
- [ ] Desktop 1440x900
- [ ] Large monitor 1920x1080

### Pages to Test
- [ ] `/` — Dashboard
- [ ] `/users` — Users table
- [ ] `/questions` — Questions table + filter bar
- [ ] `/questions/review` — Two-pane review editor
- [ ] `/categories` — Categories table
- [ ] `/faqs` — FAQs table
- [ ] `/notifications` — Notifications table + stats
- [ ] `/notifications/templates` — Templates table
- [ ] `/bonus-plans` — Bonus plans table
- [ ] `/app-settings` — Settings table
- [ ] `/subscription-history` — Subscription history table

### Checklist Per Page
- [ ] No horizontal body overflow
- [ ] Sidebar collapses on screens < 1024px with hamburger button
- [ ] Mobile topbar hamburger opens/closes sidebar
- [ ] Sidebar overlay closes on backdrop click
- [ ] All tables have a horizontal scroll region (not body scroll)
- [ ] Page headers wrap gracefully (title + action buttons)
- [ ] Filter bars wrap onto multiple lines gracefully
- [ ] Two-pane review editor stacks vertically on tablet
- [ ] Form inputs have adequate width

---

## 8. Execution Order (Phased)

```
Phase 1 — Architecture (approx 3h)
  layout.tsx — Collapsible sidebar + mobile topbar (LAY1, LAY2, LAY3)

Phase 2 — Shared Table Fix (approx 1.5h)
  users-table/data-table.tsx     — fixes 5+ pages (UP1)
  questions-data-table.tsx       — (QDT1)
  notification-list.tsx          — (NP3)
  template-list.tsx              — (TL1)
  settings-editor.tsx            — (AS1)

Phase 3 — Review Editor (approx 2h)
  content-review-panel.tsx       — stacked two-pane (CR1, CR3)
  review-editor.tsx              — button wrap + grid fix (CR4, CR5)

Phase 4 — Page Header Fixes (approx 1h)
  notifications/page.tsx         — header flex-col sm:flex-row (NP1)
  questions/page.tsx             — header flex-wrap (QP1)
  page.tsx (dashboard)           — lg:grid-cols-4 (DB1)

Phase 5 — Polish (approx 1h)
  questions/columns.tsx          — responsive max-w (QDT2)
  settings-editor.tsx            — hide col + input width (AS3, AS4)
  template-list.tsx              — hide cols on tablet (TL3)
```

**Total estimated effort: approx 8.5 engineering hours**

---

*Plan generated: 2026-07-25. Line numbers reference the current codebase revision.*
