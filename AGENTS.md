# AI Agent Guidelines (AGENTS.md)

Welcome to the `electricity-price` project. This file is the single source of instructions and context for AI coding agents (Claude Code, Copilot, Cursor, Gemini, etc.): project structure, conventions, and architectural decisions. `CLAUDE.md` imports this file and adds only Claude Code-specific workflow.

## Project Overview
- **Name:** electricity-price
- **Purpose:** Live Estonian electricity price dashboard with historical data analysis.
- **Target Audience/Users:** Estonian electricity consumers who want to monitor and analyze energy prices.

## Tech Stack & Tools
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript
- **Runtime:** Cloudflare Workers via @opennextjs/cloudflare
- **Database:** Cloudflare D1 (SQLite at edge)
- **Styling:** Tailwind CSS (Focus on premium, sleek UI, glassmorphism)
- **Data Fetching:** Native fetch API (server-side proxy to Elering API)
- **Charting:** Recharts
- **Icons & Animation:** Lucide-react, Framer-motion
- **Package Manager:** npm

## Directory Structure
- `/src/app`: Next.js App Router pages and global layouts.
- `/src/app/api`: Server-side API routes (Elering proxy, D1 queries, sync).
- `/src/components`: UI components (e.g., Dashboard, PriceChart, PriceHeatmap, Controls, CurrentPriceCard, BestWindowCard, CostCalculator); `/src/components/ui` for shared inputs (`NumericField`).
- `/src/lib`: Utility functions and hooks (e.g., `api.ts` for data fetching, `db.ts` for D1 operations, `cheapestWindow.ts` for the window search, `timezone.ts` for Tallinn time, `styles.ts` for shared class strings, `useCostCalculator.ts`, `useDashboardPrices.ts`, `usePersistedState.ts` for localStorage persistence).
- `/src/__tests__`: Test files mirroring the source structure.
- `/db`: Database schema (`schema.sql`).
- `/scripts`: Build scripts (e.g., `add-scheduled-handler.js` for Cron Triggers).

## Coding Conventions
1. **Design First:** The priority is a superb, premium UI/UX. Do not use default/basic styling.
2. **Components:** Use Server Components by default in App Router, and `'use client'` explicitly for interactive elements (charts, toggles).
3. **Timezones:** Convert UTC ↔ Europe/Tallinn with the DST-safe Intl helpers in `@/lib/timezone` — never browser-local time. date-fns `startOfDay`/`format`/`startOfWeek` use the browser's zone; key days with `getTallinnDateStr`.
4. **Calculations:** Electricity prices should be displayed in cents/kWh (the API provides €/MWh). VAT (22%) toggle must be respected in all displayed price metrics and charts.
5. **Cost Calculator:** `useCostCalculator` (`src/lib/useCostCalculator.ts`) fetches its own prices — now (floored to 15 min) → end of tomorrow in Tallinn, via `getPricesWithPrediction` — independent of the chart period, so windows can cross midnight. `computeRollingWindow` in `cheapestWindow.ts` searches 15-minute slots (`normalizeTo15MinSlots` expands hourly points), honours the "Ready by" deadline (`resolveReadyByLimit`: next occurrence, rolled to the following day only when less than half the duration remains) and falls back to the best full-length window with `bestIgnoresDeadline` when nothing fits. "Starting Now" is the average of a same-length window from now. Numeric inputs use `NumericField` (`src/components/ui/`) with parsing in `src/lib/numericInput.ts`.
6. **Database:** All aggregate tables above hourly level are computed from `hourly_averages` (not raw prices) to ensure equal hour weighting regardless of data granularity (15-min vs 1-hour).
7. **Imports:** Use `@/` path aliases for all imports.
8. **Tailwind:** Never construct class names dynamically (e.g. `bg-${color}-500`); always use complete static class strings so they survive purging in production. Tailwind `content` includes `src/lib/**` because shared class strings live in `src/lib/styles.ts` — class strings placed anywhere else outside the scanned paths are dropped.
9. **Animations:** Memoize data inputs to prevent re-renders, initialize spring/transition values from current state (not defaults), and test with the actual chart re-render cycle before marking complete.
10. **Comments:** Preserve comments that describe **intent** or **business logic** (the *why*, not the *what*). Do not remove or rewrite them during refactors — they capture original reasoning that is hard to reconstruct.

## Git Rules
- Conventional Commits: `type(scope): description`, imperative mood. Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `style`, `perf`.
- Commit after each task is completed.
- Do not commit `node_modules`, `.next`, `.open-next`, or `.wrangler` folders.
- Prioritize clear, concise, and focused pull requests/commits.
- Never approve or merge a PR without running tests and confirming all CI checks are green.

## Validation (required after every code change)
1. `npm run lint` — must pass.
2. `npm run build` — must pass.
3. `npm test` — must pass. All new code (API routes, utilities, hooks, components) needs tests.

Reference this file before making structural changes.

## Testing
- **Framework:** Vitest 4.x with jsdom environment
- **Test location:** `src/__tests__/` mirrors the source structure
- **Run tests:** `npm test` (single run), `npm run test:watch` (watch mode), `npx vitest run <path>` (single file)
- **Timezone check:** `TZ=UTC npx vitest run` — CI (ubuntu-latest) runs in UTC while dev machines are usually Europe/Tallinn, so timezone bugs can pass locally and fail in CI.
- **Naming:** `src/lib/api.ts` → `src/__tests__/lib/api.test.ts`; `.test.tsx` for components. `src/__tests__/setup.ts` loads jest-dom matchers; vitest globals are on.
- **Mocking:** Use `vi.mock()` for modules, `vi.stubGlobal()` for `fetch` (restore in `beforeEach`). Mock `@opennextjs/cloudflare` (`getCloudflareContext: vi.fn()`) in any test that imports from `@/lib/db`.
- **Patterns:** Build data with local factories (e.g. `makePrice(eurMwh, isPredicted)`); use `toBeCloseTo` for price math; pin "now" with fixed UTC instants and state the Tallinn wall time in a comment. Components: `@testing-library/react`, query by role/label, test behaviour not implementation.
- **Cover:** empty input, null, zero and negative prices, missing data, Tallinn day boundaries and DST days.

## Setup and Run
- Setup: `npm install`
- Run locally: `npm run dev` (port 3000)
- Build for production: `npm run build`
- Preview as Cloudflare Worker: `npm run preview`
- Deploy to Cloudflare Workers: `npm run deploy` (OpenNext + wrangler)
- Regenerate Cloudflare types after binding changes: `npm run cf-typegen`

## Gotchas
- Stop `npm run dev` before `npm run build` or the OpenNext build — both write `.next/`.
- `.github/workflows/deploy.yml` only validates (lint, test, build, OpenNext build, scheduled-handler patch); it does not deploy.
