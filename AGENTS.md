# AI Agent Guidelines (AGENTS.md)

Welcome to the `electricity-price` project. This file contains instructions and context for AI coding agents (like Copilot, Cursor, Gemini, etc.) to understand the project structure, conventions, and architectural decisions.

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
- `/src/components`: UI components (e.g., Dashboard, PriceChart, Controls, CurrentPriceCard).
- `/src/lib`: Utility functions (e.g., `api.ts` for data fetching, `db.ts` for D1 operations, `usePersistedState.ts` for localStorage persistence).
- `/src/__tests__`: Test files mirroring the source structure.
- `/db`: Database schema (`schema.sql`).
- `/scripts`: Build scripts (e.g., `add-scheduled-handler.js` for Cron Triggers).

## Coding Conventions
1. **Design First:** The priority is a superb, premium UI/UX. Do not use default/basic styling.
2. **Components:** Use Server Components by default in App Router, and `'use client'` explicitly for interactive elements (charts, toggles).
3. **Data Processing:** Handle timezone conversions (UTC to Europe/Tallinn) robustly using `date-fns` or native `Intl`.
4. **Calculations:** Electricity prices should be displayed in cents/kWh (the API provides €/MWh). VAT (22%) toggle must be respected in all displayed price metrics and charts.
5. **Database:** All aggregate tables above hourly level are computed from `hourly_averages` (not raw prices) to ensure equal hour weighting regardless of data granularity (15-min vs 1-hour).

## Git Rules
- Use conventional commits.
- Use imperative mood for commit messages.
- Commit after each task is completed.
- Do not commit `node_modules`, `.next`, `.open-next`, or `.wrangler` folders.

## AI Assistant Rules
- Reference `AGENTS.md` before making structural changes.
- Prioritize clear, concise, and focused pull requests/commits.
- Every time a task is completed and code is changed, run `npm run build` to validate that the web app is building successfully.
- Run `npm test` after a successful build to validate tests pass.

## Testing
- **Framework:** Vitest 4.x with jsdom environment
- **Test location:** `src/__tests__/` mirrors the source structure
- **Run tests:** `npm test` (single run) or `npm run test:watch` (watch mode)
- **Mocking:** Use `vi.mock()` for modules, `vi.stubGlobal()` for `fetch`. Mock `@opennextjs/cloudflare` in any test that imports from `@/lib/db`.
- **Rule:** All new code (API routes, utilities, hooks) must have tests. Run both `npm run build` and `npm test` before considering a task complete.

## Setup and Run
- Setup: `npm install`
- Run locally: `npm run dev`
- Run tests: `npm test`
- Build for production: `npm run build`
- Preview as Cloudflare Worker: `npm run preview`
- Deploy to Cloudflare Workers: `npm run deploy`
- Regenerate Cloudflare types: `npm run cf-typegen`
