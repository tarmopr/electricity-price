# Codebase Review Findings

> Generated: 2026-03-27
> Branch: `main` (`dd537dd`)
> Reviewer: Claude Code (Sonnet 4.6)
> Overall health: **Good (with caveats)**

## How to use this document

Each finding is a self-contained task. Work through them in severity order (Critical → Major → Minor).
After each fix, run validation:

```bash
npm run lint && npm run build && npm test
```

---

## Critical

### C1 — DST timezone offset still hardcoded in db.ts aggregates
- **File**: `src/lib/db.ts` (all four `recompute*` functions)
- **Category**: Domain Correctness
- **Issue**: All aggregate recomputations use a hardcoded `'+2 hours'` UTC offset (EET). During EEST (UTC+3, ~late March–late October) the 21:00–22:59 UTC window is assigned to the wrong local calendar date. This affects daily, weekly, monthly, and weekday-hour averages for ~7 months of the year.
- **Suggestion**: Preprocess insert timestamps at write time — store a `tallinn_date` column derived application-side using `Intl` (which handles DST correctly), then group by that column in SQL instead of computing an offset inline.

### C2 — Sync endpoint: `SYNC_SECRET` optional in production
- **File**: `src/app/api/sync/route.ts:30–40`
- **Category**: Security
- **Issue**: Authentication is skipped when `SYNC_SECRET` env var is unset. A misconfigured production deploy exposes the endpoint publicly, allowing arbitrary Elering API calls and DB writes (potential DoS / data flooding). The code comments acknowledge this but do not fail hard.
- **Suggestion**: Reject with `503 Service Unavailable` at startup if `SYNC_SECRET` is missing in a non-development environment. Alternatively, add a `NODE_ENV` guard that requires the secret in production.

### C3 — Missing timestamp format validation in hourly route
- **File**: `src/app/api/prices/hourly/route.ts:14–18`
- **Category**: Security / Input Validation
- **Issue**: `start` and `end` are converted via `new Date(str).getTime() / 1000` with only an `isNaN` guard. Malformed but non-NaN strings (e.g., `"2024"`, `"9999-99-99"`) produce unexpected timestamps that propagate to SQL. Compare to `daily/route.ts` which has an explicit `DATE_RE` regex guard.
- **Suggestion**: Add `const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/` validation before parsing, mirroring the daily route pattern.

---

## Major

### M1 — Silent error suppression in `usePatternOverlays`
- **File**: `src/lib/usePatternOverlays.ts:47–53`
- **Category**: Error Handling
- **Issue**: `.catch(() => {})` swallows all errors from `getHourlyAveragePattern()`. The overlay silently disappears on API failure with no user feedback — indistinguishable from "no data available."
- **Suggestion**: Track an `error` state in the hook and surface it to the consumer (e.g., a toast or inline warning).

### M2 — Error state not propagated from `useCostCalculator`
- **File**: `src/lib/useCostCalculator.ts`
- **Category**: Error Handling
- **Issue**: When prices fail to load, the hook receives an empty array and silently produces zero-cost results. The cost calculator UI shows `€0.00` with no indication that the underlying data fetch failed.
- **Suggestion**: Accept and re-export an `error` prop, or return `{ data: null, error: string }` when `prices.length === 0` after a known fetch failure.

### M3 — No API response pagination
- **File**: All `/api/prices/*` route handlers
- **Category**: Performance / Scalability
- **Issue**: All aggregate endpoints return every matching row with no `limit`/`offset` params. A large date range (e.g., multi-year weekly query) serializes thousands of rows into a single JSON response, stressing both the D1 read budget and client-side parsing.
- **Suggestion**: Add optional `limit` and `offset` query params to all price endpoints. Document the defaults.

### M4 — `PriceChart` and `PriceHeatmap` loaded unconditionally
- **File**: `src/components/Dashboard.tsx`
- **Category**: Performance
- **Issue**: Both heavy components are statically imported even though only one is visible at a time. Recharts (~500 KB gzip) and heatmap code are included in the initial bundle regardless of which view the user lands on.
- **Suggestion**: Replace static imports with `next/dynamic`:
  ```ts
  const PriceChart   = dynamic(() => import('./PriceChart'),   { ssr: false });
  const PriceHeatmap = dynamic(() => import('./PriceHeatmap'), { ssr: false });
  ```

### M5 — Prop drilling: 23 individual props on `Controls`
- **File**: `src/components/Controls.tsx:37–64`
- **Category**: Code Quality
- **Issue**: `ControlsProps` contains 23 individual boolean/setter pairs. Mismatching a setter to its state (e.g., passing `setShowMean` where `setShowMedian` is expected) is easy and produces a silent bug. Maintenance cost grows with each new overlay.
- **Suggestion**: Group related state into typed objects:
  ```ts
  interface ChartOverlays { showNow: boolean; showMean: boolean; showMedian: boolean; ... }
  ```
  Pass one `overlays` prop and one `setOverlays` instead of 10+ pairs.

---

## Minor

### m1 — Dead export: `getTallinnDateParts` never used
- **File**: `src/lib/timezone.ts`
- **Category**: Code Quality
- **Issue**: `getTallinnDateParts()` is exported but has no import sites in the codebase.
- **Suggestion**: Remove it or add a usage (e.g., replace inline patterns that still unpack date parts manually).

### m2 — `PriceChart.tsx` still 580 lines
- **File**: `src/components/PriceChart.tsx`
- **Category**: Code Quality
- **Issue**: The component handles state, data transformation, 5+ overlay types, and legend rendering in one file.
- **Suggestion**: Extract overlay rendering and legend into `PriceChartOverlays.tsx` and `PriceChartLegend.tsx`, and data transformation into a `usePriceChartData` hook.

### m3 — No integration tests for `useDashboardPrices`
- **File**: `src/__tests__/` (missing file)
- **Category**: Testing
- **Issue**: `useDashboardPrices` is the critical data-loading hook but has minimal test coverage. Period switching, error states, and loading transitions are untested.
- **Suggestion**: Add a `useDashboardPrices.test.ts` with MSW mocks covering: successful load, API error, empty response, and period change.

### m4 — Missing edge-case tests: DST transitions, negative prices, all-predicted data
- **File**: `src/__tests__/statistics.test.ts`, `src/__tests__/prediction.test.ts`
- **Category**: Testing
- **Issue**: No tests cover DST spring-forward/fall-back boundaries, negative price values across all code paths, or the case where `calculateStatistics()` receives only predicted prices (tomorrow view).
- **Suggestion**: Add parameterized edge-case tests for each of these scenarios.

### m5 — `Controls` hamburger not visible at small breakpoints
- **File**: `src/components/Controls.tsx`
- **Category**: Styling & UX
- **Issue**: The mobile menu toggle (hamburger icon) is conditionally rendered but its visibility class may not cover all small-screen breakpoints, leaving mobile users unable to open the controls panel.
- **Suggestion**: Audit the responsive breakpoints for the hamburger button and test on a 375px viewport.

---

## Summary

| Severity | Total | Open | Fixed |
|----------|-------|------|-------|
| Critical | 3     | 3    | 0     |
| Major    | 5     | 5    | 0     |
| Minor    | 5     | 5    | 0     |
| **Total**| **13**| **13**| **0** |
