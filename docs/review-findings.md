# Codebase Review Findings

> Generated: 2026-03-18
> Branch: `main`
> Reviewer: Claude Code (Opus 4.6)
> Overall health: **Needs Work**
> Last updated: 2026-03-26 — C1, C2, C3, C4, M6 resolved on branch `fix/critical-review-findings`; M1–M7, m5, m7 resolved in `8d8d0dd`; m1–m4, m6, m8–m13 resolved in `ac626ef` on `fix/minor-review-findings`

## How to use this document

Each finding is a self-contained task. Work through them in severity order (Critical → Major → Minor).
After each fix, run validation:

```bash
npm run lint && npm run build && npm test
```

---

## Critical

### C1 — Wrong SQL aggregate in weekday-hour recompute ✅ Fixed
- **File**: `src/lib/db.ts:171`
- **Category**: Domain Correctness
- **Issue**: `recomputeWeekdayHourAverages` uses `avg_price as avg_price` instead of `AVG(avg_price)` when grouping by `(year, month, weekday, hour)`. SQLite picks an arbitrary row's value — produces incorrect weekday-hour averages (silent data corruption).
- **Fix**: Change `avg_price as avg_price` → `AVG(avg_price) as avg_price` at line 171.
- **Resolved**: `76cecb1` fix(db): correct AVG() aggregate in weekday-hour recompute

---

### C2 — UTC grouping in SQL aggregates (wrong local date bucketing) ✅ Fixed
- **File**: `src/lib/db.ts:79, 106, 135, 163–170`
- **Category**: Domain Correctness
- **Issue**: All aggregate recomputations (`recomputeDailyAverages`, `recomputeWeeklyAverages`, `recomputeMonthlyAverages`, `recomputeWeekdayHourAverages`) use `strftime(..., 'unixepoch')` which formats in UTC. Estonia is UTC+2 (EET) / UTC+3 (EEST). Prices near midnight local time are bucketed to the wrong calendar date (e.g., 00:30 EET = 22:30 UTC the previous day).
- **Fix**: Use `strftime('%Y-%m-%d', timestamp, 'unixepoch', '+2 hours')` for EET, or handle EET/EEST offset dynamically. This is a fundamental architectural decision affecting all aggregate tables.
- **Resolved**: `720d566` fix(db): use EET-local date in SQL aggregate grouping
- **Note**: Fixed for EET (UTC+2). During EEST (UTC+3, ~late March–late October), the 21:00–21:59 UTC window (1 hour/day) is still misassigned. Full DST handling requires application-level preprocessing since SQLite has no timezone support.

---

### C3 — Browser timezone used in hourly average pattern overlay ✅ Fixed
- **File**: `src/lib/api.ts:574`
- **Category**: Domain Correctness
- **Issue**: `getHourlyAveragePattern()` uses `p.date.getHours()` (browser-local timezone). Users outside EET/EEST see the 7-day and 30-day average overlay lines shifted by their UTC offset, misaligning them with chart data.
- **Fix**: Extract hour using `Intl.DateTimeFormat` or `toLocaleString('en-US', { timeZone: 'Europe/Tallinn', hour: '2-digit', hourCycle: 'h23' })`, consistent with `buildWeekdayHourAverages` and `buildCalendarHeatmap`.
- **Resolved**: `1ad6a85` fix(lib): extract Tallinn timezone helpers and fix hour grouping in pattern overlay

---

### C4 — Browser timezone used in price predictions ✅ Fixed
- **File**: `src/lib/api.ts:224–269`
- **Category**: Domain Correctness
- **Issue**: `generatePredictedPrices()` and `generateMissingSlotPredictions()` use `Date.setHours()` / `Date.getHours()` (browser-local). For non-EET users, predictions are time-shifted relative to real data. During DST transitions, hours can be skipped or duplicated when stepping hour-by-hour.
- **Fix**: Use UTC-based arithmetic (`setUTCHours`, `getUTCHours`, or millisecond arithmetic) for all hourly stepping. Convert to Tallinn time only at the display layer.
- **Resolved**: `0cebd28` fix(lib): use UTC arithmetic for hourly stepping in price predictions

---

## Major

### M1 — Unauthenticated sync endpoint ✅ Fixed
- **File**: `src/app/api/sync/route.ts:30–128`
- **Category**: Security
- **Issue**: `POST /api/sync` has no authentication. Anyone can trigger Elering API calls and database writes with arbitrary `start`/`end` date ranges. Potential DoS vector and DB flooding.
- **Fix**: Add authentication (shared secret header, Cloudflare Access, or API key check). Add rate limiting at minimum.
- **Resolved**: `8d8d0dd` — bearer-token auth via `SYNC_SECRET` env var

---

### M2 — No input validation on date query params ✅ Fixed
- **File**: `src/app/api/prices/daily/route.ts:17–27` (and hourly route)
- **Category**: Security / Input Validation
- **Issue**: `start` and `end` query params are passed to SQL without format validation. Malformed input silently returns empty results instead of a 400 error.
- **Fix**: Validate that `start`/`end` match `YYYY-MM-DD` format (regex or `Date.parse` check) before querying. Return 400 with a descriptive message on invalid input.
- **Resolved**: `8d8d0dd` — YYYY-MM-DD regex in daily route, isNaN guard in hourly route

---

### M3 — Errors swallowed in `getPricesForDateRange` ✅ Fixed
- **File**: `src/lib/api.ts:51–108`
- **Category**: Code Quality / Error Handling
- **Issue**: All errors are caught and an empty array `[]` is returned. Callers (including `useDashboardPrices`) cannot distinguish between "no data" and "network/server failure." The chart shows empty with no error message shown to the user.
- **Fix**: Remove the catch block and let errors propagate, or return a discriminated union `{ data: ElectricityPrice[] } | { error: string }`. Surface errors in the UI.
- **Resolved**: `8d8d0dd` — try/catch removed; errors propagate to `useDashboardPrices` which surfaces them

---

### M4 — `PriceChart.tsx` oversized with inner components redefined on every render ✅ Fixed
- **File**: `src/components/PriceChart.tsx` (545 lines)
- **Category**: Code Quality / Performance
- **Issue**: `CustomTooltip`, `ChartReferenceLabel`, `MinMaxLabel`, and `CustomCursor` are defined inside the component body and recreated on every render. Data transformation logic is also inline.
- **Fix**: Move inner component definitions outside `PriceChart` (or to separate files). Extract data transformation into a `usePriceChartData` hook.
- **Resolved**: `8d8d0dd` — all four inner components moved outside; `isHovering`/`stats` passed as props

---

### M5 — URL param restoration race with `usePersistedState` hydration ✅ Fixed
- **File**: `src/components/Dashboard.tsx:100`
- **Category**: Code Quality
- **Issue**: The `useEffect` that restores state from URL params has an empty dependency array `[]` and runs on mount. `usePersistedState` hydration from localStorage may run after, overwriting the URL params.
- **Fix**: Track hydration completion with a `useRef(false)` flag. Apply URL params only after all `usePersistedState` hooks have hydrated, or give URL params explicit priority over localStorage.
- **Resolved**: `8d8d0dd` — `hydrated` exposed from `usePersistedState`; two-effect split with `urlParamsApplied` ref guard

---

### M6 — Timezone conversion pattern duplicated 5× ✅ Fixed
- **File**: `src/lib/api.ts:315–346`, `src/lib/heatmapData.ts:213–244` (and 3 other locations)
- **Category**: Architecture & Structure
- **Issue**: The pattern `toLocaleDateString('en-CA', { timeZone: 'Europe/Tallinn' })` + `new Date(dateStr + 'T12:00:00').getDay()` + `toLocaleString` for hour extraction is duplicated across `buildWeekdayHourAverages`, `generateMissingSlotPredictions`, `buildCalendarHeatmap`, `buildPatternHeatmap`, and `getCheapestWindowHours`.
- **Fix**: Extract a shared utility `getTallinnDateParts(date: Date): { dateStr: string; hour: number; weekday: number }` in a new `src/lib/timezone.ts` module. Replace all 5 call sites. (Also resolves C3 and C4 if implemented correctly.)
- **Resolved**: `1ad6a85` fix(lib): extract Tallinn timezone helpers and fix hour grouping in pattern overlay — created `src/lib/timezone.ts` with `getTallinnHour`, `getTallinnDateStr`, `getTallinnWeekday`, `getTallinnDateParts`; replaced all duplicated inline patterns in `api.ts`

---

### M7 — Elering chunking logic duplicated between client and server ✅ Fixed
- **File**: `src/lib/api.ts`, `src/lib/elering.ts:56–101`
- **Category**: Architecture & Structure
- **Issue**: `CHUNK_SIZE_MS` date-range chunking and the `.999Z` end-date boundary hack are implemented independently in both client-side `api.ts` and server-side `elering.ts`.
- **Fix**: Since the client already proxies through `/api/prices`, move all chunking responsibility to the server-side proxy. The client should make a single request with the full date range.
- **Resolved**: `8d8d0dd` — `/api/prices/route.ts` now delegates to `fetchFromElering`; client `getPricesForDateRange` makes a single fetch

---

## Minor

### m1 — Inaccurate footer timezone text ✅ Fixed
- **File**: `src/app/page.tsx:32`
- **Category**: Styling & UX
- **Issue**: Footer states "converted to your local time" — incorrect, the app uses Europe/Tallinn throughout.
- **Fix**: Change to "Prices shown in Estonian time (EET/EEST)".
- **Resolved**: `ac626ef`

---

### m2 — Heatmap view button uses hardcoded styles ✅ Fixed
- **File**: `src/components/Dashboard.tsx:238`
- **Category**: Styling & UX
- **Issue**: The Heatmap button has inline hardcoded `bg-indigo-400/20 text-indigo-300 border-indigo-400/50` instead of using `pillClass` from `@/lib/styles`.
- **Fix**: Either extend `pillClass` with a color-variant parameter or define a named constant in `styles.ts`.
- **Resolved**: `ac626ef` — `PILL_ACTIVE_INDIGO` constant added to `styles.ts`

---

### m3 — Stat buttons bypass shared pill styles ✅ Fixed
- **File**: `src/components/Controls.tsx:283–303`
- **Category**: Styling & UX
- **Issue**: Now / Mean / Median buttons have hardcoded active/inactive Tailwind strings instead of `PILL_BASE`/`pillClass` from `@/lib/styles`.
- **Fix**: Adopt shared style constants or document the intentional divergence.
- **Resolved**: `ac626ef` — comment added documenting intentional per-stat colour divergence

---

### m4 — Unsafe `JSON.parse` cast in `usePersistedState` ✅ Fixed
- **File**: `src/lib/usePersistedState.ts:29`
- **Category**: Security
- **Issue**: `JSON.parse(stored) as T` performs an unchecked cast. Corrupted localStorage values would pass through as `T` without runtime validation, potentially causing downstream errors with complex types like `AlertConfig`.
- **Fix**: Add a `typeof` guard for primitive types; for object types, wrap in a try/catch that falls back to the default value.
- **Resolved**: `ac626ef` — type guard added; null values explicitly allowed through (valid for `number | null` slots)

---

### m5 — `getHours()` in chart data mapping uses browser timezone ✅ Fixed
- **File**: `src/components/PriceChart.tsx:110`
- **Category**: Domain Correctness
- **Issue**: `const hour = item.date.getHours()` uses browser-local timezone when mapping prices to avg overlay data points. Non-EET users see misaligned overlay lines.
- **Fix**: Use Tallinn-based hour extraction (same fix as C3 / M6 `getTallinnDateParts`).
- **Resolved**: `8d8d0dd` — `getTallinnHour(item.date)` replaces `item.date.getHours()`

---

### m6 — `api.ts` too large with mixed concerns (590 lines) ✅ Fixed
- **File**: `src/lib/api.ts`
- **Category**: Architecture & Structure
- **Issue**: Single file mixes type definitions, data fetching, price prediction, statistics calculation, and heatmap data building.
- **Fix**: Split into `api-client.ts` (fetch), `statistics.ts` (`calculateStatistics`), `prediction.ts` (`generatePredictedPrices`, `buildWeekdayHourAverages`). Move `ElectricityPrice` type to `types.ts`.
- **Resolved**: `ac626ef` — statistics and prediction functions extracted to `statistics.ts` and `prediction.ts`; `api.ts` re-exports for backwards compatibility

---

### m7 — `cheapestWindow` "until" limit uses browser timezone ✅ Fixed
- **File**: `src/lib/cheapestWindow.ts:74–83`
- **Category**: Domain Correctness
- **Issue**: `setHours(untilHour)` uses browser-local timezone for the upper time bound. Non-EET users get a different effective cutoff than intended.
- **Fix**: Convert `untilHour` to a UTC timestamp using Europe/Tallinn as the reference timezone.
- **Resolved**: `8d8d0dd` — UTC arithmetic via `getTallinnHour` replaces `setHours`; `startHour` uses `getTallinnHour`

---

### m8 — `framer-motion` loaded eagerly for single animation ✅ Fixed
- **File**: `src/components/AnimatedPrice.tsx`
- **Category**: Performance
- **Issue**: Full `framer-motion` (~40KB gzip) is eagerly imported for a single number interpolation animation.
- **Fix**: Replace with a CSS `transition` or use `next/dynamic` with `ssr: false` to lazy-load `framer-motion`.
- **Resolved**: `ac626ef` — `next/dynamic` with `ssr: false` for `motion.span`

---

### m9 — `Dashboard` manages ~20 state pieces inline ✅ Fixed
- **File**: `src/components/Dashboard.tsx`
- **Category**: Code Quality
- **Issue**: Cost calculator state and derived values sit inline alongside unrelated chart/period state.
- **Fix**: Extract cost calculator state and derived computations into a `useCostCalculator` hook.
- **Resolved**: `ac626ef` — `useCostCalculator` hook extracts all 5 persisted state slots and 3 derived memos

---

### m10 — Chart `role="img"` lacks accessible text summary ✅ Fixed
- **File**: `src/components/PriceChart.tsx:359`
- **Category**: Accessibility
- **Issue**: `role="img"` declared but no meaningful description for screen readers.
- **Fix**: Add a descriptive `aria-label` (e.g., "Electricity price chart: prices range from X to Y cents/kWh") or a visually-hidden `<table>` with key data points.
- **Resolved**: `ac626ef` — dynamic `aria-label` using actual `minPoint`/`maxPoint` values

---

### m11 — Heatmap cells not keyboard-accessible ✅ Fixed
- **File**: `src/components/PriceHeatmap.tsx`
- **Category**: Accessibility
- **Issue**: Grid cells use `onMouseEnter`/`onMouseLeave` only — no `tabIndex`, `onFocus`/`onBlur`, or keyboard navigation.
- **Fix**: Add `tabIndex={0}`, `onFocus`/`onBlur` handlers mirroring mouse events, and arrow-key navigation via `onKeyDown`.
- **Resolved**: `ac626ef` — `role=grid/row/columnheader/rowheader/gridcell`, `tabIndex=0`, `onFocus/onBlur/onKeyDown` added

---

### m12 — Shallow test coverage: no interaction tests, no DST edge cases ✅ Fixed
- **File**: `src/__tests__/` (multiple test files)
- **Category**: Testing
- **Issue**: `PriceChart.test.tsx` and `Dashboard.test.tsx` check rendering but not interaction behavior (overlay toggles, period changes, VAT toggle effects). No DST transition tests in prediction or heatmap utilities.
- **Fix**: Add interaction tests for Dashboard state changes. Add edge case tests: DST spring-forward/fall-back, empty data, negative prices, API error states.
- **Resolved**: `ac626ef` — VAT toggle, period switch, heatmap view-mode interaction tests; negative-price and statistics edge-case tests added

---

### m13 — `cn()` utility not consistently adopted ✅ Fixed
- **File**: `src/lib/utils.ts`
- **Category**: Code Quality
- **Issue**: `cn()` is only used by shadcn/ui components. Application components concatenate Tailwind strings manually.
- **Fix**: Either adopt `cn()` across all components or add a comment that it is intentionally scoped to shadcn/ui.
- **Resolved**: `ac626ef` — JSDoc added scoping `cn()` to shadcn/ui; application components use `src/lib/styles.ts` constants

---

## Summary

| Severity | Total | Open | Fixed |
|----------|-------|------|-------|
| Critical | 4     | 0    | 4     |
| Major    | 7     | 0    | 7     |
| Minor    | 13    | 11   | 2     |
| **Total**| **24**| **11**| **13** |

## Implementation order

### ✅ Done (branch `fix/critical-review-findings`, not yet merged)

| # | Finding | Commit |
|---|---------|--------|
| 1 | **C1** — Fix `AVG()` bug in `db.ts` | `76cecb1` |
| 2 | **M6** — Extract `src/lib/timezone.ts` utility | `1ad6a85` |
| 3 | **C3** — Fix `getHourlyAveragePattern` hour grouping | `1ad6a85` |
| 4 | **C2** — Fix UTC date grouping in SQL aggregates | `720d566` |
| 5 | **C4** — UTC arithmetic for prediction hour stepping | `0cebd28` |

### Remaining (open)

6. **m5** — `PriceChart.tsx:110` `getHours()` uses browser timezone — use `getTallinnHour` from `src/lib/timezone.ts`
7. **M1** — Add sync endpoint authentication
8. **M2** — Add input validation on API route date query params
9. **M3** — Fix swallowed errors in `getPricesForDateRange`
10. **M4** — Extract inner components from `PriceChart`
11. **M5** — Fix URL param hydration race in `Dashboard`
12. **M7** — Consolidate chunking logic to server side
13. **m7** — `cheapestWindow` "until" limit uses browser timezone — use `getTallinnHour`
14. **m1–m4** — Quick wins: footer text, style consistency, localStorage validation
15. **m8–m13** — Performance, accessibility, and test coverage improvements
