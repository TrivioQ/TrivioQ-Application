# TrivioQ Web App — Responsive Design Plan

> **Author:** Senior UI Developer  
> **Scope:** `apps/web` (Next.js 14, Tailwind CSS v3, Framer Motion)  
> **Goal:** Ensure every page and component renders beautifully on all target devices — mobile (≥320px), tablet (≥768px), desktop (≥1024px), and large desktop (≥1280px).

---

## 1. Executive Summary

The current `apps/web` codebase is **partially responsive**. The Navbar has a well-implemented mobile slide-out drawer, the landing page hero adapts reasonably well, and the dashboard stat cards use a 2→4 grid. However, a detailed audit reveals **14 distinct responsive issues** across 8 pages and 6 shared components. This plan documents every issue with a precise, code-level fix strategy.

---

## 2. Breakpoint System

The project uses Tailwind's default breakpoints. This plan targets:

| Breakpoint | Name     | Min Width | Target Devices                  |
|------------|----------|-----------|---------------------------------|
| (default)  | xs/mobile| 320px     | Small phones (iPhone SE)        |
| `sm`       | small    | 640px     | Large phones (iPhone 15 Pro Max)|
| `md`       | medium   | 768px     | Tablets (iPad portrait)         |
| `lg`       | large    | 1024px    | Tablets landscape, small laptops|
| `xl`       | xlarge   | 1280px    | Desktop                         |
| `2xl`      | 2xlarge  | 1536px    | Large desktop / 4K              |

---

## 3. Full Component Audit

### 3.1 Navbar (`src/components/navbar.tsx`)

**Current State:** ✅ Mostly Responsive  
Already has a slide-out mobile drawer (`md:hidden`), hamburger button, and a skeleton loader. Desktop links are `hidden md:flex`.

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| N1 | Streak/Score pills are `hidden sm:flex` — on small phones (320–639px) these disappear but are only shown inside the dropdown. On narrow viewports the avatar + chevron can crowd the right side. | Lines 189–198 | Medium |
| N2 | The mobile drawer width is `w-72` (288px). On a 320px device, this leaves only 32px of backdrop visible, making it hard to close by clicking outside. Should be `w-[min(288px,85vw)]`. | Line 279 | Low |
| N3 | `px-6 lg:px-8` on the nav — there is no `md` intermediate step, so padding jumps abruptly on medium screens. | Line 161 | Low |

**Fix Strategy:**

```tsx
// N2: Make the mobile drawer width dynamic
className="... w-[min(288px,85vw)] ..."   // line 279

// N3: Padding intermediate step
className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex ..."  // line 161
```

---

### 3.2 Landing / Home Page (`src/app/[locale]/page.tsx`)

**Current State:** ⚠️ Partially Responsive  

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| H1 | Hero heading is `text-5xl md:text-7xl`. On 320–374px phones `text-5xl` (48px) is too large and causes text overflow / truncation. Should start at `text-4xl` (36px). | Line 13 | High |
| H2 | Hero section has `pt-16 pb-20` at all sizes. On mobile this wastes vertical space — should be `pt-10 pb-14 md:pt-16 md:pb-20`. | Line 9 | Medium |
| H3 | App-store download buttons: The leaderboard text link beside them needs a `text-center` for mobile. | Line 18 | Low |
| H4 | Social Proof Strip: On mobile the items are `flex-col` with `gap-8`, causing large whitespace. Reduce to `gap-5 sm:gap-8`. | Line 54 | Low |
| H5 | How It Works section inner card `p-8` on 320px is tight. Change card padding to `p-5 sm:p-8`. | Line 91 | Medium |
| H6 | Features section grid: `grid-cols-1 gap-x-12 gap-y-16 lg:grid-cols-3`. On tablet (`md`) there is no 2-column option, so features render in a single tall column. Add `md:grid-cols-2` to show 2 then 3 columns. | Line 110 | High |

**Fix Strategy:**

```tsx
// H1: Responsive heading
<h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold ...">

// H2: Section padding
<section className="relative pt-10 pb-14 md:pt-16 md:pb-20 px-6 lg:px-8 ...">

// H6: Features 2-col tablet
<dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 md:max-w-3xl lg:max-w-none lg:grid-cols-3">
```

---

### 3.3 Dashboard Page (`src/app/[locale]/dashboard/page.tsx`)

**Current State:** ⚠️ Partially Responsive

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| D1 | Outer container uses `py-24` at all sizes. On mobile this pushes content way down. Should be `py-12 sm:py-16 md:py-24`. | Line 55 | High |
| D2 | Dashboard heading `text-4xl` on mobile is too large for 320px. Should be `text-3xl md:text-4xl`. | Line 58 | Medium |

---

### 3.4 DashboardStats (`src/components/dashboard/dashboard-stats.tsx`)

**Current State:** ⚠️ Partially Responsive

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| DS1 | Stat Cards grid: `grid-cols-2 sm:grid-cols-4`. On 320–374px phones, `grid-cols-2` forces two cards side by side with `p-6` padding — they become too narrow (~128px each). The card's `text-3xl` value overflows. | Line 110 | High |
| DS2 | Score Trend Charts: `grid-cols-1 lg:grid-cols-2`. On `md` tablets both charts stack — acceptable, but reduce card padding on mobile. | Line 130 | Low |
| DS3 | Recent Drops list: Each drop row is `flex items-start gap-4`. On 320px, the right-side points badge can crowd the question text. Consider stacking on mobile. | Line 164 | Medium |

**Fix Strategy:**

```tsx
// DS1: Reduce padding inside StatCard on mobile
<div className="rounded-2xl ... p-4 sm:p-6 flex flex-col gap-1">
  <div className="text-2xl sm:text-3xl font-extrabold ...">

// DS3: Recent drop rows on mobile: stack layout
<div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
```

---

### 3.5 ActiveDropCard (`src/components/dashboard/active-drop-card.tsx`)

**Current State:** ✅ Mostly Responsive  

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| A1 | Card body has `px-6 py-5` at all sizes. On 320px this gives answer options very little horizontal text space. Reduce to `px-4 sm:px-6`. | Line 312 | Medium |
| A2 | Timer display with expired state buttons are right-aligned. On narrow screens this can overlap the left content header. | Lines 285–309 | Low |
| A3 | The "Hint / Reveal Answer" row uses `flex gap-2` with `flex-1` buttons — at 320px the button text may wrap. | Lines 340–358 | Low |

---

### 3.6 Leaderboard Page + LeaderboardTabs (`src/components/leaderboard-tabs.tsx`)

**Current State:** ❌ Not Mobile-Friendly  
This is the most critical responsive failure in the app.

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| L1 | The leaderboard is a `<table>` with 4 columns, each using `px-8 py-6`. No `overflow-x-auto` wrapper. On mobile this overflows horizontally. | Lines 110–148 | **Critical** |
| L2 | Table column `px-8` padding means each column is ≥80px minimum. Columns will overflow on 320px. | Lines 113–116 | **Critical** |
| L3 | Streak column can be hidden on mobile and shown inline with the player name cell. | Lines 115, 134–140 | High |
| L4 | Tab buttons `px-6 py-2.5` — on 320px screens, three tabs may overflow since the container is `w-fit mx-auto`. | Line 88 | High |
| L5 | Leaderboard page title `text-4xl md:text-6xl` — needs `text-3xl sm:text-4xl md:text-6xl`. | Line 77 | Medium |
| L6 | Period-ends badge uses long date string. On 320px this wraps and breaks the pill shape. Use a shorter format on mobile. | Line 97 | Medium |

**Fix Strategy:**

```tsx
// L1 + L2: Add scroll wrapper + reduce column padding
<div className="overflow-x-auto -mx-4 sm:mx-0">
  <table className="w-full min-w-[500px] text-left border-collapse">
    <th className="px-4 sm:px-8 py-3 sm:py-5 text-xs ...">
    <td className="px-4 sm:px-8 py-4 sm:py-6 ...">

// L3: Hide streak column on mobile
<th className="hidden sm:table-cell ..."> Streak </th>
<td className="hidden sm:table-cell ..."> {streak} </td>

// L4: Tab row scrollable on small screens
<div className="flex justify-start sm:justify-center overflow-x-auto p-1 ...">
  // reduce tab padding: px-4 sm:px-6
```

---

### 3.7 Score History Page + ScoreHistoryTabs (`src/components/score-history-tabs.tsx`)

**Current State:** ❌ Not Mobile-Friendly

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| SH1 | The `HistoryTable` renders a 5-column table with `px-6` padding per cell. No `overflow-x-auto` wrapper. On mobile this overflows. | Lines 56–83 | **Critical** |
| SH2 | Period column text (e.g., "Jun 23 – Jun 29, 2025") can be long. Needs truncation on mobile. | Line 69 | High |
| SH3 | "Bonus" column can be hidden on mobile to reduce column count. | Lines 60–64 | High |

**Fix Strategy:**

```tsx
// SH1: Scroll wrapper
<div className="overflow-x-auto -mx-4 sm:mx-0 overflow-hidden rounded-2xl border border-white/10">
  <table className="w-full min-w-[480px] text-left">

// SH2: Clamp period label width
<td className="px-4 sm:px-6 py-4 text-sm text-text font-medium max-w-[140px] sm:max-w-none truncate">

// SH3: Mobile-hide Bonus column
<th className="hidden md:table-cell px-4 sm:px-6 py-4 text-right">Bonus</th>
<td className="hidden md:table-cell px-4 sm:px-6 py-4 text-right">...</td>
```

---

### 3.8 Settings Page (`src/app/[locale]/settings/settings-form.tsx`)

**Current State:** ✅ Mostly Responsive

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| SET1 | Section cards `p-6 space-y-6` — on 320px forms feel slightly tight. Minor. | Line 132 | Low |
| SET2 | The `daysToSpend` stepper can wrap awkwardly at 320px if the label text is long. | Subscription line 285 | Low |

---

### 3.9 Subscription Page (`src/components/subscription-settings.tsx`)

**Current State:** ⚠️ Partially Responsive

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| SUB1 | Plan header `flex items-center justify-between` — badge can stack below title on mobile, looking misaligned. Add `items-start sm:items-center`. | Line 199 | Low |
| SUB2 | Stepper `flex items-center gap-3` — the "of N available" label will push to a second line on 320px. Wrap in a flex column with `sm:flex-row`. | Line 285 | Medium |

---

### 3.10 Login / Signup Pages

**Current State:** ✅ Mostly Responsive

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| LOG1 | Login card has `p-10` padding. On 320px this leaves only 240px for content. Reduce to `p-6 sm:p-10`. | Line 52 | Medium |
| LOG2 | `text-3xl` brand name and heading — on 320px a long brand name could overflow. Use `text-2xl sm:text-3xl`. | Lines 54, 57 | Low |

---

### 3.11 Footer (`src/components/footer.tsx`)

**Current State:** ✅ Mostly Responsive

**Issues Found:**

| # | Issue | Location (line) | Severity |
|---|-------|-----------------|----------|
| F1 | On `sm` (640–767px), the brand column `sm:col-span-2` + 2 link columns + 1 CTA don't fit in 2 columns evenly. Consider `grid-cols-2 md:grid-cols-4`. | Line 54 | Medium |
| F2 | Bottom bar shows a lonely `·` separator on mobile. Should hide with `hidden sm:inline`. | Lines 108–113 | Low |

---

## 4. Global Patterns to Standardize

### 4.1 Container Padding
Standardize across all pages:

```css
/* Add to globals.css */
@layer components {
  .page-container {
    @apply mx-auto max-w-5xl px-4 sm:px-6 md:px-8;
  }
}
```

### 4.2 Page-Level Vertical Padding
**Rule:** Use `py-12 sm:py-16 md:py-20 lg:py-24` pattern for all page wrappers instead of flat `py-24`.

### 4.3 Table Responsiveness Standard
Every `<table>` must be wrapped in:
```tsx
<div className="overflow-x-auto -mx-4 sm:mx-0">
  <table className="w-full min-w-[480px] ...">
```

### 4.4 Heading Scale Standard
Standardize page-level h1 sizes:
```
text-3xl sm:text-4xl md:text-5xl lg:text-6xl
```

### 4.5 Card Padding Standard
```
p-4 sm:p-6     ← regular cards
p-6 sm:p-8     ← hero/featured cards
```

---

## 5. Implementation Priority Matrix

| Priority | Issue(s) | Pages/Components | Impact |
|----------|----------|------------------|--------|
| 🔴 P1 — Critical | L1, L2, SH1 | Leaderboard, Score History | Tables overflow screen |
| 🔴 P1 — Critical | H6 | Landing Page | Features grid broken on tablet |
| 🟠 P2 — High | D1, DS1, H1 | Dashboard, Landing | Spacing/size on phones |
| 🟠 P2 — High | L3, L4, SH2, SH3 | Leaderboard, Score History | Crowded columns on mobile |
| 🟡 P3 — Medium | A1, DS3, LOG1, SUB2 | Active Drop, Login, Subscription | Minor padding/wrapping |
| 🟢 P4 — Low | N2, N3, H2, H3, H4, F1, F2, A2 | Various | Polish / minor UX |

---

## 6. File-by-File Change Summary

| File | Lines to Modify | Changes |
|------|-----------------|---------|
| `src/components/navbar.tsx` | 161, 279 | Drawer width cap; add `sm:` padding step |
| `src/app/[locale]/page.tsx` | 9, 13, 54, 91, 110 | Heading scale; section padding; features 2-col tablet |
| `src/app/[locale]/dashboard/page.tsx` | 55, 58 | Vertical padding; heading scale |
| `src/components/dashboard/dashboard-stats.tsx` | 60, 110, 131, 164 | Card padding; grid breakpoints; drop row flex direction |
| `src/components/dashboard/active-drop-card.tsx` | 285, 312 | Card horizontal padding |
| `src/app/[locale]/leaderboard/page.tsx` | 73, 75, 77 | Page padding; heading scale |
| `src/components/leaderboard-tabs.tsx` | 86–148 | Table scroll wrapper; col padding reduction; hide streak col; tab scroll |
| `src/components/score-history-tabs.tsx` | 55–83 | Table scroll wrapper; hide bonus col; period text clamp |
| `src/app/[locale]/settings/settings-form.tsx` | 189 | Password form max-width |
| `src/components/subscription-settings.tsx` | 199, 285 | Plan header flex; stepper wrap |
| `src/app/[locale]/login/page.tsx` | 52, 54, 57 | Card padding; heading scale |
| `src/components/footer.tsx` | 54, 111 | Grid cols fix; hide separator dot on mobile |
| `src/app/globals.css` | — | Add `.page-container` utility |

---

## 7. Testing Checklist

### Devices to Test
- [ ] iPhone SE (375×667) — smallest common phone
- [ ] iPhone 12/13 Pro (390×844)
- [ ] iPhone 15 Pro Max (430×932)
- [ ] iPad (768×1024) — portrait & landscape
- [ ] iPad Pro 11" (834×1194)
- [ ] MacBook 13" (1280×800)
- [ ] Desktop 1440×900
- [ ] 4K (2560×1440)

### Pages to Test
- [ ] `/` — Landing Page
- [ ] `/login` — Login
- [ ] `/signup` — Signup
- [ ] `/dashboard` — Dashboard (logged in)
- [ ] `/leaderboard` — Leaderboard
- [ ] `/score-history` — Score History
- [ ] `/settings` — Settings
- [ ] `/subscription` — Subscription

### Checklist Per Page
- [ ] No horizontal scrollbar on the page body
- [ ] Text does not overflow containers
- [ ] Buttons have minimum 44×44px touch target
- [ ] Tables have horizontal scroll on mobile
- [ ] Forms are usable with on-screen keyboard
- [ ] Navbar hamburger opens/closes correctly
- [ ] Footer columns collapse to single column on mobile
- [ ] Dark mode works at all breakpoints

---

## 8. Additional Recommendations

1. **Touch targets**: Several `w-9 h-9` (36px) buttons are below WCAG's 44px recommendation. Bump to `w-11 h-11 sm:w-9 sm:h-9`.

2. **Custom `xs` breakpoint**: Add an `xs: 480px` breakpoint in `tailwind.config.ts` to bridge the 0→640px gap for the stat card grid.

```ts
// tailwind.config.ts
theme: {
  extend: {
    screens: {
      'xs': '480px',
    },
  },
},
```

3. **Container queries**: Consider `@tailwindcss/container-queries` plugin for `DashboardStats` to make cards self-managing.

4. **Viewport height**: Use `min-h-dvh` instead of `min-h-screen` to handle mobile browser chrome (URL bar) layout shifts.

5. **Image optimization**: `/logo.png` in navbar and footer should use Next.js `<Image>` with explicit `width` and `height`.

6. **Font size minimum**: Ensure no interactive text is below `text-xs` (12px).

---

## 9. Execution Order (Phased)

```
Phase 1 — Critical (~2h)
├── leaderboard-tabs.tsx       → table overflow fix (L1, L2)
├── score-history-tabs.tsx     → table overflow fix (SH1)
└── page.tsx (landing)         → features grid tablet fix (H6)

Phase 2 — High (~2h)
├── dashboard/page.tsx         → padding and heading (D1, D2)
├── dashboard-stats.tsx        → stat card padding and grid (DS1, DS3)
└── leaderboard-tabs.tsx       → column hiding + tab scroll (L3, L4, L5, L6)

Phase 3 — Medium (~1.5h)
├── active-drop-card.tsx       → padding reduction (A1)
├── login/page.tsx             → card padding (LOG1)
├── subscription-settings.tsx  → stepper wrap (SUB2)
└── globals.css                → page-container utility

Phase 4 — Polish (~1h)
├── navbar.tsx                 → drawer width + padding step (N2, N3)
├── footer.tsx                 → grid fix + separator dot (F1, F2)
└── All pages                  → heading scale audit pass
```

**Total estimated effort: ~6.5 engineering hours**

---

*Plan generated: 2026-07-25. Line numbers reference the current codebase revision.*
