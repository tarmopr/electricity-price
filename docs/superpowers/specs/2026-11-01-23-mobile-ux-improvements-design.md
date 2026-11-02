# Mobile UX improvements — design (#23)

- **Issue:** #23 "Improvements for small (mobile device) screen" (GitHub Issues, label `enhancement`)
- **Branch:** `feature/23-mobile-ux-improvements`, base `main` at `6e6e5b7` (`origin/main` fetched 2026-11-01, branch has no commits beyond it; no open PRs in the repo)
- **Location:** this file, committed on the feature branch (ledger ruling)
- **Written by:** ship-issue Spec stage, 2026-11-01. Every decision below is either the issue's (quoted) or a `Ruling` of this stage, listed in section 10.

## 1. Intent

The owner uses the app on a phone, mostly for one job: when to charge a plug-in hybrid overnight. On a 390 px screen the period card, the calculator settings and a fixed-width chart push the things he looks at (chart, cost comparison) far down the page. The issue lists six changes:

1. Period card collapsible on small screens, "like cost calculator", so users "can collaps it to see the best time … and see the chart".
2. Chart "horizontally scrollable and zoom in and out (time scale)".
3. A plug-in hybrid preset, 14 kWh, 8 h, ready by 07:00, "put it as first".
4. Calculator settings and results collapsible separately: "when my default selection is used, then i want to quickly see the comparison, and not change the settigs which I do less often."
5. An option to allow or exclude predicted prices in the cheapest-window search: "when the prediction is not allowed, then the until time (ready by) is limited to time when the predicted price starts".
6. "Next 24h" first and "default when not saved".

**Goals:** less vertical scrolling on phones; the calculator's comparison one tap away; a chart readable at 15-minute resolution on a phone.
**Non-goals:** pinch-to-zoom, changing the heatmap, changing the desktop layout beyond what these items need.
**Anti-goals:** losing an existing user's saved settings; presenting predicted prices as official when the user excluded them; a toolbar that overflows at 390 px.

## 2. Scope and delivery

One PR for all six items, one commit per item plus one docs commit (order in section 8). `Ruling` R1.

| # | Item | Files |
|---|---|---|
| 6 | Next 24h first + default | `src/components/Controls.tsx`, `src/components/Dashboard.tsx` |
| 3 | Plug-in Hybrid preset first | `src/lib/costCalculator.ts` |
| 5 | Allow / exclude predicted prices | `src/lib/cheapestWindow.ts`, `src/lib/useCostCalculator.ts`, `src/components/CostCalculator.tsx`, `src/components/BestWindowCard.tsx`, `src/components/Dashboard.tsx` |
| 4 | Settings collapse separately from results | `src/lib/useCostCalculator.ts`, `src/components/CostCalculator.tsx`, `src/components/Dashboard.tsx` |
| 1 | Collapsible period card below `lg` | `src/components/Controls.tsx`, `src/components/Dashboard.tsx` |
| 2 | Chart zoom + horizontal scroll | new `src/lib/chartZoom.ts`, `src/components/PriceChart.tsx` |
| — | Docs | `README.md`, `docs/PRD.md`, `AGENTS.md` (rule 5) |

Each item's tests are in its own commit (AGENTS.md "All new code … needs tests"; test paths mirror source: `src/lib/chartZoom.ts` → `src/__tests__/lib/chartZoom.test.ts`).

## 3. Evidence and baseline

`.claude/ship-plan.md` has no `## Evidence` section, so no deployed environment was read. The baseline is a local reproduction: `npm run dev` on `main` at `6e6e5b7` (prices proxied from the public Elering API, local D1), measured 2026-11-01 ~20:30 Tallinn with Playwright `playwright-core@1.48.2` + installed Chrome (`.claude/ship-plan/blockers.md`, UI), context `{ viewport: 390×844, isMobile: true, hasTouch: true, timezoneId: 'Europe/Tallinn' }`, empty `localStorage`.

### 3.1 Measured (390 × 844, fresh visit)

| What | Today |
|---|---|
| Period pills, in order | `Yesterday`, `Today` (aria-pressed=true), `Tomorrow`, `Next 24h` |
| `localStorage` right after the first load | holds `eprice_period: "today"`, `eprice_costPreset: "EV Charge"`, `eprice_costCalcOpen: false`, … (17 keys) although nothing was chosen |
| Controls (period) card | top 378 px, **height 266 px** |
| Chart (`role="img"`) | **top 737 px** (107 px of it inside the 844 px screen), height 300, `clientWidth 340 = scrollWidth 340`, `overflow-x: hidden` |
| Chart toolbar (view toggle + share) | width 340 px, children 259 px → ~81 px free |
| Cost calculator (opened) | height 841 px; settings blocks 276 px (presets) + 252 px (inputs) come before the results (182 px); **"Starting Now" label 651 px below the calculator's top** |
| Document height | 1308 px |

At 1440 × 900: same pill order and default; chart 1102 px wide, `scrollWidth = clientWidth`.

### 3.2 Code facts the design rests on

- **Defaults are written back on hydrate.** `src/lib/usePersistedState.ts:49-56` persists `value` as soon as `hydrated` is true, including an untouched default; `src/lib/useCostCalculator.ts:24-28` already says so: "usePersistedState wrote the default back on hydrate, so almost every returning user has it stored without ever choosing it." Confirmed by the `localStorage` row above. Consequence: a changed default reaches first-time visitors only, and every new persisted key is locked to its default for everyone on their next visit.
- **Period default:** `src/components/Dashboard.tsx:41` `usePersistedState<Period>('period', 'today')`; pill order `src/components/Controls.tsx:12-17` (`yesterday, today, tomorrow, next_24h`). Shared links always carry the period (`src/lib/shareState.ts:32` `params.set(PARAM_MAP.period, state.period)`), so the default does not affect them.
- **Period card today:** period pills + VAT are "Always visible (incl. mobile)" (`Controls.tsx:148`); only overlays and price alert collapse, below `md` (`Controls.tsx:234-249`, `md:hidden`). That came from #13 (`a1623cc`, "Mobile: period pills always visible"); the issue now asks for the whole card. The card is on its own row below `lg`: `Dashboard.tsx:196` `grid grid-cols-1 lg:grid-cols-3`.
- **Presets:** `src/lib/costCalculator.ts:17-26`, `DEFAULT_PRESET = PRESETS[0]` with the comment "Default calculator state = EV Charge preset." Pinned by `src/__tests__/lib/costCalculator.test.ts:51-52` (`toEqual({ label: "EV Charge", kWh: 40, durationHours: 8, readyBy: "07:00" })`), `src/__tests__/lib/useCostCalculator.test.ts:104-110`, and `docs/PRD.md:51` ("EV Charge (…, the default)"). `DEFAULT_PRESET` is read only by `useCostCalculator.ts:70-80` (`git grep DEFAULT_PRESET -- src`).
- **Calculator collapse:** one toggle for everything, `CostCalculator.tsx:181-224` (`{isOpen && (…presets, inputs, results…)}`); open state persisted as `costCalcOpen` (`useCostCalculator.ts:74`).
- **Predicted points are a suffix; predicted slots are not always.** `src/lib/prediction.ts:15-17` predicts "from the hour after the last actual data point", and `getPricesWithPrediction` returns `[...actualData, ...predictedData]` (`prediction.ts:101`). But `normalizeTo15MinSlots` also flags fill slots beyond a point's native span as predicted (`cheapestWindow.ts:151-155,176,189`: `isPredicted: p.predicted || k >= nativeSlots`), so one missing 15-minute official point (gap 15 min before, 30 min after) yields a single predicted slot in the middle of official prices. "Where predictions start" therefore means the start of the trailing run of predicted slots, not the first predicted slot (builder check).
- **Ready-by does not bound the horizon stats.** `computeRollingWindow` (`cheapestWindow.ts:333-400`) computes `horizonAvgPrice`, `horizonMaxPrice` (358-368) and `startingNowPrice` (373-383) over the whole horizon; only `findCheapestSlotWindow` gets the deadline (385-396).
- **Today the search always uses predictions:** `npx vitest run src/__tests__/lib/cheapestWindow.test.ts -t "sets isPredicted when the best window uses predicted prices"` → `1 passed | 63 skipped` (input `[9, 9, 9, 9, 1, 1, 9]`, predicted from index 4, 2 h → best is the predicted 1 ¢ pair; there is no option to exclude them).
- **Recharts 3.7.0** (`node_modules/recharts/package.json`).
  - Touch scrolling is not blocked: the chart wrapper's `onTouchMove` only dispatches (`lib/chart/RechartsWrapper.js:304-312`); the only `preventDefault` in `lib/` is the Brush's arrow-key handler (`lib/cartesian/Brush.js:141`).
  - The Y domain and nice ticks depend on displayed data, the items' data keys and the axis props, not on width: `selectAllAppliedValues` / `selectNumericalDomain` / `selectAxisDomain` / `combineNiceTicks` (`lib/state/selectors/axisSelectors.js:368,717,751,789-803`). Default Y-axis width is 60 (`lib/util/Constants.js:21`), default X-axis height 30 (`axisSelectors.js:63`).
  - `Brush` ("Renders a scrollbar that allows the user to zoom and pan", `types/cartesian/Brush.d.ts`) defaults to `height: 40` and `travellerWidth: 5`.
- **Tailwind:** only complete static class strings (AGENTS.md rule 8). `PILL_BASE`, `PILL_INACTIVE`, `PILL_ACTIVE_INDIGO`, `pillClass` exist in `src/lib/styles.ts:9-25`. `zinc-950` is used in `src/app/page.tsx:9`; the app is dark only (`src/app/globals.css:5-10`, no light tokens).
- **Icons used below exist in lucide-react 0.575:** `ZoomIn`, `ZoomOut`, `CalendarClock`, `SlidersHorizontal` (checked with `require('lucide-react')`).
- **Typecheck covers tests:** `tsconfig.json` `include: ["**/*.ts", "**/*.tsx", …]`, and the config's `Typecheck` gate runs `npx tsc --noEmit -p .`. A new required prop therefore needs every test props object updated in the same commit.
- **Test baseline:** `npx vitest run` → `39 passed (39)` files, `665 passed (665)` tests.

## 4. Design, in commit order

### 4.1 Item 6 — Next 24h first and default

- `Controls.tsx` `PRIMARY_PERIODS`: move `{ value: 'next_24h', label: 'Next 24h' }` to the first position; the rest keep their order: `Next 24h, Yesterday, Today, Tomorrow`.
- `Dashboard.tsx:41`: default `'next_24h'`.
- Stored values are left alone (issue: "default when not saved"). Because of the write-back (3.2), returning visitors keep the `today` stored on their first visit; first-time visitors get Next 24h. No migration. `Ruling` R2.
- Tests:
  - `Controls.test.tsx` "lists Next 24h as the first period pill": `within(screen.getByRole("group", { name: /period selection/i })).getAllByRole("button")[0]` has accessible name `Next 24h`.
  - `Dashboard.test.tsx` "defaults to the Next 24h period": `render(<Dashboard />)` (its `usePersistedState` mock returns the default) → `expect(useDashboardPrices).toHaveBeenCalledWith("next_24h", expect.any(String), expect.any(String))` and the `Next 24h` pill has `aria-pressed="true"`.

### 4.2 Item 3 — Plug-in Hybrid preset, first in the list

`src/lib/costCalculator.ts`:

```ts
const EV_CHARGE: ConsumptionPreset = { label: "EV Charge", kWh: 40, durationHours: 8, readyBy: "07:00" };

// Overnight appliances default to being done by 07:00 (before the morning commute/peak)
export const PRESETS: ConsumptionPreset[] = [
  { label: "Plug-in Hybrid", kWh: 14, durationHours: 8, readyBy: "07:00" },
  EV_CHARGE,
  // Washing Machine, Dryer, Dishwasher, Sauna unchanged
];

/** Default calculator state = EV Charge preset. Plug-in Hybrid is listed first but is not the default. */
export const DEFAULT_PRESET = EV_CHARGE;
```

- The existing comment on line 16 stays above `PRESETS` (AGENTS.md rule 10).
- `DEFAULT_PRESET` stays EV Charge. `Ruling` R3: the issue says only "put it as first" here, while item 6 says "first option and default"; the default is pinned by two tests and the PRD (3.2). Existing users are unaffected either way (their preset values are stored).
- Tests:
  - `costCalculator.test.ts` "lists Plug-in Hybrid first (14 kWh, 8 h, ready by 07:00)": `expect(PRESETS[0]).toEqual({ label: "Plug-in Hybrid", kWh: 14, durationHours: 8, readyBy: "07:00" })`. The default-preset test (line 51) stays as is and must still pass.
  - `CostCalculator.test.tsx` "selecting the Plug-in Hybrid preset sets 14 kWh, 8 h and 07:00" (settings open): click `Plug-in Hybrid` → `setActivePreset("Plug-in Hybrid")`, `setConsumptionKwh(14)`, `setDurationHours(8)`, `setReadyBy("07:00")`; the pill shows `14 kWh · 8 h`.

### 4.3 Item 5 — Allow or exclude predicted prices

**Semantics** (`Ruling` R4). Excluding predictions limits the window search only, exactly like the ready-by deadline does: the best window (and its deadline fallback) uses official slots only and must end at or before the start of the trailing run of predicted slots ("official prices end"). Starting Now, Next-hours average and Peak keep using the whole horizon, predictions included, as they do with a ready-by time today (3.2), and the results say so (note below), so predicted prices are never shown as official. Reasons: the issue asks to "exclude the predicted price range from the cheapest window" and frames it as a ready-by limit; and a Starting Now estimate for an 8 h run must keep pricing all 8 hours. Default: predictions allowed (today's behaviour).

**`src/lib/cheapestWindow.ts`**

- `RollingWindowOptions` gets
  ```ts
  /** Search official prices only: predicted slots are skipped and windows end where official prices end. Horizon stats still use every slot. */
  excludePredicted?: boolean;
  ```
- `RollingWindowResult` gets
  ```ts
  /** Where official prices end: start of the trailing run of predicted slots, or null when the horizon ends on an official slot */
  predictedFrom: Date | null;
  ```
  set in both the `empty` result and the full result, whether or not predictions are excluded.
- In `computeRollingWindow`, right after `horizon` is built:
  ```ts
  // Official prices end where the trailing run of predicted slots starts. A predicted
  // fill inside official data (one missing 15-min point) does not end them.
  let trailingStart = horizon.length;
  while (trailingStart > 0 && horizon[trailingStart - 1].isPredicted) trailingStart--;
  const predictedFrom = trailingStart < horizon.length ? new Date(horizon[trailingStart].startMs) : null;
  // Predictions excluded: the search (not the horizon stats) uses official slots only;
  // a skipped fill is a hole that findCheapestSlotWindow never spans
  const searchSlots = excludePredicted
    ? horizon.slice(0, trailingStart).filter((s) => !s.isPredicted)
    : horizon;
  ```
  Both `findCheapestSlotWindow` calls (deadline and fallback) take `searchSlots`; it skips windows across holes (`cheapestWindow.ts:231`). `startIndex`/`endIndex` then index `searchSlots` — the "searched slot array" their doc already names, and nothing outside `cheapestWindow.ts` reads them (`git grep -n "startIndex\|endIndex" -- src ':!src/__tests__'` lists only that file). An empty `searchSlots` returns `best: null`, `bestIgnoresDeadline: false`.
- Update the function's doc comment with one sentence on `excludePredicted`.

**`src/lib/useCostCalculator.ts`**

- `const [costAllowPredicted, setCostAllowPredicted] = usePersistedState<boolean>('costAllowPredicted', true);`
- `computeRollingWindow(points, { …, excludePredicted: !costAllowPredicted })`; add `costAllowPredicted` to the `useMemo` deps.
- Return `costAllowPredicted, setCostAllowPredicted` and `predictedFromMs: rolling?.predictedFrom?.getTime() ?? null`.
- `costNoData` unchanged (stats still cover the full horizon).

**`src/components/CostCalculator.tsx`**

- New props: `allowPredicted: boolean; setAllowPredicted: (val: boolean) => void;` (required) and `/** Where official prices end (start of the trailing predicted slots), or null */ predictedFromMs?: number | null;` (default `null`).
- A fourth field after "Ready by" in the inputs grid:
  ```tsx
  <div className="flex flex-col gap-1.5">
    <span className={LABEL_CLASS}>Prices</span>
    <button type="button" onClick={() => setAllowPredicted(!allowPredicted)} aria-pressed={allowPredicted}
      className={`${PILL_BASE} self-start ${allowPredicted ? PILL_ACTIVE_INDIGO : PILL_INACTIVE}`}>
      Use predicted prices
    </button>
    {officialEndHint && <p className="text-xs text-zinc-500">Official prices end {officialEndLabel} — the search stops there</p>}
  </div>
  ```
  Indigo is the app's predicted colour (`BestWindowCard.tsx:34-35`, chart `#6366f1`). Toggling does not change the active preset (it is not a preset property).
- `officialEndLabel = formatTallinnDeadline(new Date(predictedFromMs), new Date(nowMs))`; `officialEndHint` is true when `!allowPredicted && predictedFromMs !== null && nowMs != null && (readyByLimitMs === null || predictedFromMs < readyByLimitMs)`.
- No-window line (`CostCalculator.tsx:375-379`): when `!allowPredicted && predictedFromMs !== null && nowMs != null`, it reads `No {formatDuration(searchedHours)} window fits before predicted prices start ({officialEndLabel}).`; otherwise unchanged.
- Stats note (so predicted prices are not presented as official): directly after the estimates grid block (the `estimates.length > 0` branch, below "Show more"), when `!allowPredicted && predictedFromMs !== null && nowMs != null`: `<p className="text-xs text-zinc-500">Starting now, average and peak include predicted prices from {officialEndLabel}.</p>`.

**`src/components/BestWindowCard.tsx`**

- New optional props `/** True when predicted prices are excluded from the search */ excludesPredicted?: boolean` (default `false`) and `predictedFromMs?: number | null` (default `null`).
- In the `!window` branch (after the error and no-data branches): when `excludesPredicted && predictedFromMs !== null && nowMs !== null` → `No {searchedDuration} window fits before predicted prices start ({formatTallinnDeadline(new Date(predictedFromMs), now)}). Tap to adjust.`; otherwise the existing text.

**`src/components/Dashboard.tsx`:** destructure `costAllowPredicted, setCostAllowPredicted, predictedFromMs`; pass `excludesPredicted={!costAllowPredicted}` and `predictedFromMs` to `BestWindowCard`; `allowPredicted`, `setAllowPredicted`, `predictedFromMs` to `CostCalculator`.

**Tests** (factories already in the files; times stated in Tallinn):

- `cheapestWindow.test.ts`, `describe("computeRollingWindow")`, using `hourlyFromTallinn(tallinnHour, prices, predictedFrom)`; now = first point (20:00, 14 Jun 2024 EEST):
  1. "excludePredicted: the search ends where predicted prices start" — `[9, 9, 9, 9, 1, 1, 9]`, predicted from 4, 2 h, no ready-by → `best.averagePrice` 9, `best.startTimestamp` `"2024-06-14T17:00:00.000Z"`, `isPredicted` false, `predictedFrom` `"2024-06-14T21:00:00.000Z"` (00:00), `horizonAvgPrice` ≈ 47/7, `horizonMaxPrice` 9 (stats unchanged).
  2. "excludePredicted: no window when official prices are shorter than the duration" — `[9, 9, 1, 1, 1, 1]`, predicted from 2, 4 h → `best` null, `bestIgnoresDeadline` false, `predictedFrom` `"2024-06-14T19:00:00.000Z"`, `horizonAvgPrice` ≈ 22/6.
  3. "excludePredicted: a later ready-by is capped where predictions start" — `[5, 5, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1]`, predicted from 4, 2 h, ready by `"07:00"` → best 22:00–00:00 (`endTimestamp` `"2024-06-14T21:00:00.000Z"`), average 3, `bestIgnoresDeadline` false.
  4. "excludePredicted: the deadline fallback stays on official prices" — `[9, 9, 2, 2, 1, 1]`, predicted from 4, 2 h, ready by `"21:00"` (1 h away = half the duration, not rolled over) → best 22:00–00:00, average 2, `bestIgnoresDeadline` true, `isPredicted` false. The same input without `excludePredicted` picks the predicted 00:00–02:00 (average 1).
  5. "predictedFrom is null when every slot is official" — `[1, 2, 3]`.
  6. "excludePredicted: a filled gap inside official prices is skipped, not where official prices end" — built inline (no helper): official 15-minute points at `Date.UTC(2024, 5, 14, 17) + k × 15 min` for k = 0…11 except k = 2 (20:00–22:45, 20:30 missing), price 1 for k = 3 and 4, else 5; then predicted hourly points at 23:00 and 00:00 (`"2024-06-14T20:00:00.000Z"`, `"2024-06-14T21:00:00.000Z"`), price 0. 0.5 h, no ready-by, `excludePredicted` → `best.startTimestamp` `"2024-06-14T17:45:00.000Z"` (20:45), average 1, `isPredicted` false; `predictedFrom` `"2024-06-14T20:00:00.000Z"` (23:00), not the 20:30 fill.
- `useCostCalculator.test.ts` (existing clock: 20:10 Tallinn, `hourly("2024-06-14T17:00:00.000Z", [20, 20, 20, 2, 2, 2, 2, 2, 2, 2, 2, 9, 9, 9], 7)`):
  1. "allows predicted prices by default" → `costAllowPredicted` true.
  2. "excluding predicted prices keeps the window on official prices" — `act(() => result.current.setCostAllowPredicted(false))` → `cheapestWindow` null (8 h does not fit before 03:00), `costNoData` false, `predictedFromMs` = `Date.parse("2024-06-15T00:00:00.000Z")`; then `setCostDurationHours(2)` → window `2024-06-14T20:00:00.000Z`–`2024-06-14T22:00:00.000Z`, `isPredicted` false.
  3. "persists the predicted-price choice" → after setting false, `localStorage.getItem("eprice_costAllowPredicted")` is `"false"`.
- `CostCalculator.test.tsx` (both props objects, `defaultProps` and `base`, get `allowPredicted: true, setAllowPredicted: vi.fn()`):
  1. toggle `Use predicted prices` has `aria-pressed="true"`; a click calls `setAllowPredicted(false)` and not `setActivePreset`.
  2. `allowPredicted={false}`, `predictedFromMs` = `2024-06-04T22:00:00.000Z` (01:00), `readyByLimitMs` = `2024-06-05T04:00:00.000Z` → text `Official prices end 01:00 — the search stops there`.
  3. same with `cheapestWindow={null}` → `No 8 h window fits before predicted prices start (01:00).`
  4. `allowPredicted={false}`, `predictedFromMs` as in 2 → `Starting now, average and peak include predicted prices from 01:00.`; with `allowPredicted` true the note is absent.
- `BestWindowCard.test.tsx`: `window={null}`, `excludesPredicted`, `predictedFromMs` = `2024-06-14T22:00:00.000Z` (01:00) → `No 8 h window fits before predicted prices start (01:00). Tap to adjust.`
- `Dashboard.test.tsx`: `makeCostCalc` gains `costAllowPredicted: true, setCostAllowPredicted: vi.fn(), predictedFromMs: null`; new test "passes the excluded-predictions state to the card": `makeCostCalc({ costAllowPredicted: false, predictedFromMs: Date.parse("2024-01-01T22:00:00.000Z"), cheapestWindow: null })` (00:00 Tallinn on 2 Jan; `costNowMs` is 11:00) → within the mobile card copy (`bestWindowCopies(container).mobile`) the text `No 8 h window fits before predicted prices start (00:00). Tap to adjust.`

### 4.4 Item 4 — Settings collapse separately from results

**Design** (`Ruling` R5). The header keeps collapsing the whole card (unchanged, `costCalcOpen`). Inside an open card, the settings (presets, consumption, duration, ready-by, prices toggle) sit behind their own disclosure row, collapsed by default and persisted; the results are always shown while the card is open:

```
[Cost Calculator header ▾]                      ← costCalcOpen (unchanged)
[⚙ SETTINGS  Plug-in Hybrid · 14 kWh · 8 h · ready by 07:00   ▾]   ← costSettingsOpen
   (expanded: presets, inputs, prices toggle — today's content)
[predicted note] [deadline warning] [estimate cards + Show more] [no-window line] [stale notice] [savings]
```

Reasons: the stated use case ("quickly see the comparison, and not change the settings"); and item 1's complaint about scrolling — a design with an always-visible settings row outside the collapsed card adds a row to the page. The combination "settings shown, results hidden" is not offered; nothing in the issue needs it, and results update live while settings are edited.

- `useCostCalculator.ts`: `const [costSettingsOpen, setCostSettingsOpen] = usePersistedState<boolean>('costSettingsOpen', false);`, returned next to `costCalcOpen`.
- `CostCalculator.tsx` props: `settingsOpen: boolean; setSettingsOpen: (val: boolean) => void;` (required).
- Disclosure row, first element of the open body:
  ```tsx
  <button type="button" onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen}
    aria-label="Toggle calculator settings"
    className="w-full flex items-center justify-between gap-2 min-h-11 rounded-xl border border-zinc-800/60 bg-zinc-800/20 px-3 text-left text-zinc-400 hover:text-zinc-200 transition-colors">
    <span className="flex items-center gap-2 min-w-0">
      <SlidersHorizontal className="w-4 h-4 shrink-0" />
      <span className={LABEL_CLASS}>Settings</span>
      {!settingsOpen && <span className="text-xs text-zinc-400 truncate">{settingsSummary}</span>}
    </span>
    {settingsOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
  </button>
  {settingsOpen && (<div className="space-y-5">{/* today's "Appliance" block and inputs grid, incl. the prices field */}</div>)}
  ```
  `aria-label` follows the existing `"Toggle cost calculator"` pattern (`CostCalculator.tsx:184`); no `aria-controls`, like the existing toggles.
- `settingsSummary` = `` `${activePreset} · ${formatNumber(consumptionKwh)} kWh · ${formatDuration(searchedHours)} · ${readyBy !== null ? `ready by ${readyBy}` : "no deadline"}${allowPredicted ? "" : " · official prices only"}` `` (one text node; shown only while collapsed, so it never duplicates a preset pill's text in `getByText` queries).
- The results block (from the predicted note through savings) is unchanged and follows the settings.
- `Dashboard.tsx` passes `settingsOpen={costSettingsOpen}` and `setSettingsOpen={setCostSettingsOpen}`. `openCostCalculator` (Best Window card tap) still opens the card and scrolls to it; in addition, when the card shows its "No … window fits … Tap to adjust." state — `cheapestWindow === null && !costLoading && costError === null && !costNoData` (the same branch order as `BestWindowCard.tsx:80-108`) — it also calls `setCostSettingsOpen(true)`, so the tap lands on fields to adjust. Otherwise the settings state is left alone. The `useCallback` deps grow accordingly. (Builder check; spec-stage call.)
- Tests:
  - Both `CostCalculator.test.tsx` props objects (`defaultProps`, `base`) get `settingsOpen: false, setSettingsOpen: vi.fn()`. Every test that queries anything inside the settings — `Appliance`, preset pills, the kWh / duration / ready-by fields, the prices toggle and its hint, including the tests added by commits 2 and 3 — renders with `settingsOpen` true (`openProps` becomes `{ ...defaultProps, isOpen: true, settingsOpen: true }`; tests of the collapsed-settings state pass `settingsOpen={false}`).
  - New: "settings start collapsed to a one-line summary while results show" (open card, settings closed): no `Appliance`, `Toggle calculator settings` has `aria-expanded="false"`, text `EV Charge · 40 kWh · 8 h · ready by 07:00`, `Starting Now` present.
  - New: "the settings row toggles settings" → click calls `setSettingsOpen(true)`.
  - New: "summary names no deadline and official-only prices" → `activePreset="Custom"`, `consumptionKwh={2}`, `durationHours={2}`, `readyBy={null}`, `allowPredicted={false}`, `cheapestWindow={null}` (the summary shows the searched duration, `cheapestWindow?.hours ?? snapDurationHours(durationHours)` at `CostCalculator.tsx:99`, so the 8 h mock window must not be passed) → `Custom · 2 kWh · 2 h · no deadline · official prices only`.
  - New: "results stay visible with settings open" → both `Appliance` and `Starting Now`.
  - `useCostCalculator.test.ts` "settings start collapsed and persist" → `costSettingsOpen` false; after `setCostSettingsOpen(true)`, `localStorage.getItem("eprice_costSettingsOpen")` is `"true"`.
  - `Dashboard.test.tsx`: `makeCostCalc` gains `costSettingsOpen: false, setCostSettingsOpen: vi.fn()`; a test that needs the settings fields in the open calculator sets `costSettingsOpen: true` (none of today's Dashboard tests query them: `grep -n "Appliance\|Ready by\|Washing" src/__tests__/components/Dashboard.test.tsx` finds nothing).
  - New Dashboard test "tapping the card when no window fits opens the settings too": `makeCostCalc({ cheapestWindow: null, setCostCalcOpen, setCostSettingsOpen })`, same `requestAnimationFrame` spy as the existing tap test → after a tap on the mobile copy, `setCostCalcOpen(true)` and `setCostSettingsOpen(true)`. The existing "tapping the Best Window card opens the cost calculator" test (with a window) additionally asserts `setCostSettingsOpen` was not called.

### 4.5 Item 1 — Collapsible period card below `lg`

**Design** (`Ruling` R6). Below `lg` (where the card has its own row, `Dashboard.tsx:196`) the whole Controls card collapses to a header row, mirroring the cost calculator. From `lg` up nothing changes. Open by default (issue: "users can collaps it"); persisted. The inner below-`md` "Chart Controls" toggle for overlays and alert stays inside.

- `Dashboard.tsx`: `const [controlsOpen, setControlsOpen] = usePersistedState<boolean>('controlsOpen', true);` passed as `isOpen` / `setIsOpen`.
- `Controls.tsx`: new required props `isOpen: boolean; setIsOpen: (val: boolean) => void;` (names match `CostCalculator`).
- Header, first child of the card:
  ```tsx
  <button type="button" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-label="Toggle period controls"
    className="lg:hidden w-full flex items-center justify-between gap-2 min-h-11 text-zinc-300 hover:text-zinc-100 transition-colors">
    <span className="flex items-center gap-2.5 min-w-0">
      <CalendarClock className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="text-sm font-semibold tracking-wide uppercase whitespace-nowrap">Period</span>
      {!isOpen && <span className="text-xs text-zinc-500 truncate">{periodSummary}</span>}
    </span>
    {isOpen ? <ChevronUp className="w-5 h-5 text-zinc-500 shrink-0" /> : <ChevronDown className="w-5 h-5 text-zinc-500 shrink-0" />}
  </button>
  ```
  `periodSummary` = `` `${label} · ${includeVat ? "incl. VAT" : "excl. VAT"}` ``, `label` from `[...PRIMARY_PERIODS, ...MORE_PERIODS]` (custom → `Custom`). Shown only while collapsed. The `aria-label` keeps the header out of existing `{ name: /today/i }` pill queries.
- Everything else in the card goes into one wrapper: `className={`${isOpen ? "flex" : "hidden"} lg:flex flex-col mt-3 lg:mt-0`}`.
- The inner "Period" `Label` gets `hidden lg:block` (the header already says "Period" below `lg`).
- The comment at `Controls.tsx:148` becomes "Period pills + VAT toggle (inside the collapsible card below lg)"; the one at line 234 becomes "Below md: price alert + stat overlays collapse separately inside the card".
- Collapsed card height: `p-4` + `min-h-11` = 76 px.
- Tests (`Controls.test.tsx`; `defaultProps` gains `isOpen: true, setIsOpen: vi.fn()`; reuse `isInsideHiddenContainer`):
  - "collapsing hides the whole card below lg": `isOpen={false}` → `Toggle period controls` has `aria-expanded="false"` and class `lg:hidden`; the period group and `Include VAT` button are inside a `hidden` container; that container's class contains `lg:flex`.
  - "collapsed header summarises period and VAT": `isOpen={false}`, `period="next_24h"`, `includeVat` → text `Next 24h · incl. VAT`; with `period="custom"`, `includeVat={false}` → `Custom · excl. VAT`.
  - "the header toggles the card": click → `setIsOpen(false)` when open.
  - The existing "period pills and VAT toggle are visible on mobile without expanding Chart Controls" keeps passing with `isOpen: true`.
  - `Dashboard.test.tsx` "the period card starts expanded": `Toggle period controls` has `aria-expanded="true"`.

### 4.6 Item 2 — Chart zoom and horizontal scroll

**Design** (`Ruling` R7). Zoom widens the chart inside a natively scrollable box; − / + buttons below the chart set the time scale; the price axis stays pinned on the left while zoomed. Reasons: the issue asks for "horizontally scrollable"; native scrolling gives momentum swipe on phones, trackpad / shift-wheel on desktop, and arrow keys once focusable; Recharts does not block touch scrolling (3.2). Rejected: Recharts `Brush` (40 px default height out of a 300 px phone chart, 5 px travellers against the app's 44 px touch targets, `styles.ts:8`) and pinch zoom (two-finger gestures need a single-pointer alternative anyway, so buttons come first; pinch is out of scope). Buttons go below the chart because the toolbar has ~81 px free at 390 px (3.1) and needs ~128 px.

**`src/lib/chartZoom.ts`** (pure):

```ts
/** Chart zoom factors: chart width as a multiple of the visible width. */
export const ZOOM_LEVELS = [1, 2, 4, 8] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
/** Next larger level, or the same level at the maximum. */
export function nextZoomLevel(level: ZoomLevel): ZoomLevel;
/** Next smaller level, or the same level at the minimum. */
export function prevZoomLevel(level: ZoomLevel): ZoomLevel;
/**
 * scrollLeft that keeps the time at the viewport centre in place when the chart
 * width changes from oldZoom × clientWidth to newZoom × clientWidth.
 * Clamped to [0, clientWidth × (newZoom − 1)].
 */
export function anchoredScrollLeft(scrollLeft: number, clientWidth: number, oldZoom: number, newZoom: number): number;
```

Formula: `ratio = (scrollLeft + clientWidth / 2) / (clientWidth * oldZoom)`; result `ratio * clientWidth * newZoom - clientWidth / 2`, clamped. Tests (`src/__tests__/lib/chartZoom.test.ts`): levels step 1→2→4→8 and stop at both ends; `anchoredScrollLeft(0, 340, 1, 2)` = 170; `(170, 340, 2, 4)` = 510; `(510, 340, 4, 2)` = 170; `(170, 340, 2, 1)` = 0; `(1020, 340, 4, 8)` = 2210; a result past the end is clamped to `clientWidth × (newZoom − 1)`; `clientWidth` 0 returns 0.

**`src/components/PriceChart.tsx`**

- State `const [zoom, setZoom] = useState<ZoomLevel>(1)`, `const scrollRef = useRef<HTMLDivElement>(null)`, `const pendingScroll = useRef<number | null>(null)`; a `useLayoutEffect` on `[zoom]` applies `pendingScroll` to `scrollRef.current.scrollLeft` and clears it. All hooks stay above the early returns (Rules of Hooks, as noted at `PriceChart.tsx:291`).
- `changeZoom(next)`: if `scrollRef.current`, `pendingScroll.current = anchoredScrollLeft(el.scrollLeft, el.clientWidth, zoom, next)`; then `setZoom(next)`.
- Zoom is not persisted and survives period changes and data refreshes (component state); it resets on reload. `Ruling` R8.
- Main return structure:
  ```tsx
  <div>
    <div className="w-full h-[300px] sm:h-[400px] mt-4 relative overflow-hidden">
      <div ref={scrollRef}
        className={`h-full ${zoom > 1 ? "overflow-x-auto overflow-y-hidden" : "overflow-hidden"}`}
        role={zoom > 1 ? "region" : undefined}
        aria-label={zoom > 1 ? "Scrollable price chart" : undefined}
        tabIndex={zoom > 1 ? 0 : undefined}>
        <div className="flex h-full" style={{ width: `${zoom * 100}%` }}>
          {zoom > 1 && (
            <div aria-hidden="true" data-testid="y-axis-overlay"
              className="sticky left-0 z-10 h-full w-12 shrink-0 -mr-12 pointer-events-none bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-transparent">
              {/* overlay axis chart, below */}
            </div>
          )}
          <div className="h-full flex-1 min-w-0" role="img" aria-label={/* unchanged */} style={{ WebkitTapHighlightColor: 'transparent' }}>
            <ResponsiveContainer …>{/* main AreaChart, unchanged except YAxis tick */}</ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
    {/* zoom controls row */}
  </div>
  ```
  Inline `style` width is used because the factor is data (Tailwind classes must be static; the skeleton does the same for heights, `DashboardSkeleton.tsx:18-19`). The sticky overlay is inside the scroll box, so its height is the chart's height even when a classic scrollbar takes space.
- Main chart: `YAxis tick={zoom > 1 ? false : { fill: '#71717a', fontSize: 12 }}` (the axis keeps its 60 px width; the overlay draws the labels). Nothing else in the main chart changes.
- Overlay chart (same height, so the same Y scale — 3.2):
  ```tsx
  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
    <AreaChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
      <XAxis dataKey="timestamp" tick={false} tickLine={false} axisLine={false} />
      <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(val) => `${val}¢`}
        domain={[calculatedMin, 'auto']} allowDataOverflow={true} />
      <Area dataKey="knownPrice" stroke="none" fill="none" isAnimationActive={false} activeDot={false} />
      <Area dataKey="predictedPrice" stroke="none" fill="none" isAnimationActive={false} activeDot={false} />
      {showAvg7d && avg7dPattern && <Line dataKey="avg7d" stroke="none" dot={false} isAnimationActive={false} />}
      {showAvg30d && avg30dPattern && <Line dataKey="avg30d" stroke="none" dot={false} isAnimationActive={false} />}
    </AreaChart>
  </ResponsiveContainer>
  ```
  The overlay's series and Y-axis props must mirror the main chart's whenever either changes. The `-20` left margin and default 60 px axis put the axis line at x = 40 in both charts; the 48 px overlay leaves an 8 px plot.
- Zoom controls row, after the frame:
  ```tsx
  <div className="flex items-center justify-end gap-2 mt-2 px-2 sm:px-0">
    {zoom > 1 && <span className="mr-auto text-xs text-zinc-500">Scroll sideways for more</span>}
    <button type="button" aria-label="Zoom out" disabled={zoom === 1} onClick={() => changeZoom(prevZoomLevel(zoom))}
      className={`${PILL_BASE} ${PILL_INACTIVE} flex items-center disabled:opacity-40`}><ZoomOut className="w-4 h-4" /></button>
    <span className="text-xs text-zinc-400 tabular-nums w-6 text-center">{zoom}×</span>
    <button type="button" aria-label="Zoom in" disabled={zoom === 8} onClick={() => changeZoom(nextZoomLevel(zoom))}
      className={`${PILL_BASE} ${PILL_INACTIVE} flex items-center disabled:opacity-40`}><ZoomIn className="w-4 h-4" /></button>
  </div>
  ```
  Shown at every width (one DOM, no breakpoint logic); not shown in the loading or "No data available" states.
- Area animation, tooltip and labels are unchanged (AGENTS.md rule 9: no new animation). A wider chart gives more X ticks (`minTickGap`) and more room for the cheapest-window label (`chartLabel.ts` is width-agnostic).
- Tests (`PriceChart.test.tsx`; its `recharts` mock already covers every component used, and `Dashboard.test.tsx`'s too, so neither mock changes):
  - "at 1× the chart is not scrollable": `Zoom out` disabled; no `region` named `Scrollable price chart`; one `area-chart`; the zoom label shows `1×`; `getByRole("img", …).parentElement!.style.width` is `"100%"`.
  - "zoom in widens the chart and pins the price axis": click `Zoom in` → `screen.getByRole("img", { name: /electricity price chart/i }).parentElement!.style.width` is `"200%"`; region `Scrollable price chart` has `tabindex="0"`; `getByTestId("y-axis-overlay")` exists; two `area-chart`s; label `2×`.
  - "zoom stops at 8×": three clicks → `8×`, `Zoom in` disabled; then `Zoom out` → `4×`.

## 5. Persisted settings and existing users

| Key (`eprice_` prefix) | Default | Existing visitor after deploy |
|---|---|---|
| `period` | `next_24h` (was `today`) | keeps the stored value (usually `today`, written back on first visit) |
| `costPreset`, `costKwh`, `costDuration`, `costReadyBy` | EV Charge (unchanged) | unchanged |
| `costAllowPredicted` (new) | `true` | behaves as today; stored `true` on first visit |
| `costSettingsOpen` (new) | `false` | an opened calculator now shows results with settings collapsed (the asked-for behaviour) |
| `controlsOpen` (new) | `true` | period card open as today until collapsed |
| zoom | not persisted | — |

Because of the write-back (3.2), a later change to any of the new defaults would reach first-time visitors only. Like `costCalcOpen` today, a persisted collapsed state renders open/closed by default for one frame before hydration.

## 6. Docs (last commit)

- `README.md` Features: Periods line (Next 24h first, the default for first-time visitors; "always visible, also on phones" becomes "the card collapses to a one-line summary on phones and tablets"); Price chart line (zoom 1–8× with − / + and sideways scrolling, price axis stays visible); Cost calculator line (Plug-in Hybrid 14 kWh / 8 h ready by 07:00 listed first, EV Charge the default; settings collapse to a summary; "Use predicted prices" toggle).
- `docs/PRD.md`: 3.2 new "Zoom & Scroll" bullet; 3.3 Timeframe (order, default) and Mobile Layout (collapsible card below `lg`); 3.5 Rolling Horizon (predictions unless excluded; with them excluded the stats note that Starting Now, average and peak still include them), Inputs (presets list, prices toggle), new "Settings" bullet (collapsible, summary), Ready-by Rules (excluded predictions cap the search), Persistence (settings open state and the predicted-price choice).
- `AGENTS.md` rule 5: add "With predicted prices excluded (`costAllowPredicted` false) the window search — not Starting Now, average or peak — skips predicted slots and ends where official prices end (`predictedFrom`, the start of the trailing predicted slots)."

## 7. Out of scope

- Pinch-to-zoom and ctrl/⌘-wheel zoom (follow-up; buttons are the accessible base).
- Heatmap zoom or scroll.
- A migration that moves stored `today` to `next_24h` (R2; precedent if wanted later: `migrateLegacyReadyBy`, `useCostCalculator.ts:40-56`).
- `DashboardSkeleton` mirroring the collapsed states (first load only).
- Repositioning the tooltip at the scroll viewport's edge.
- Existing browser-local formatting in the chart (`format(new Date(tick), xAxisFormat)` at `PriceChart.tsx:462` and the tooltip's `format(date, 'MMM d, HH:mm')` at `PriceChart.tsx:89`, against AGENTS.md rule 3) — pre-existing, a separate fix.

## 8. Commit order and build check

| # | Commit subject | Builds from |
|---|---|---|
| 1 | `feat(controls): make Next 24h the first and default period (#23)` | itself (reorder + default + tests) |
| 2 | `feat(calculator): add a Plug-in Hybrid preset listed first (#23)` | itself (`EV_CHARGE` const keeps `DEFAULT_PRESET`) |
| 3 | `feat(calculator): option to exclude predicted prices from the best window (#23)` | itself: `excludePredicted` / `predictedFrom` in `cheapestWindow.ts`, hook fields, the new required `CostCalculator` props and every test props object updated in the same commit (typecheck covers tests); `BestWindowCard` props are optional |
| 4 | `feat(calculator): collapse settings separately from results (#23)` | commit 3 (`allowPredicted` used by the summary) + itself (`costSettingsOpen`, required `settingsOpen` props and test props) |
| 5 | `feat(controls): collapsible period card on small screens (#23)` | itself (`controlsOpen` in Dashboard, required `isOpen` props + `Controls.test.tsx` `defaultProps`) |
| 6 | `feat(chart): zoom and scroll the price chart horizontally (#23)` | itself (`chartZoom.ts` added in the same commit as its first use) |
| 7 | `docs: describe the mobile UX changes (#23)` | — |

Checked: no commit reads a name added by a later one (3 adds `predictedFromMs`/`allowPredicted` before 4 reads them; 5 and 6 touch nothing from 3–4 except `Dashboard.tsx`, in different lines). No subject puts a closing keyword before the key.

## 9. Acceptance

### 9.1 Commands (run on today's tree, `6e6e5b7`)

| Command | Today | After |
|---|---|---|
| `git grep -n "usePersistedState<Period>('period'" -- src/components/Dashboard.tsx` | `…:41: … ('period', 'today');` | one line, `'next_24h'` |
| `git grep -n -A1 "const PRIMARY_PERIODS" -- src/components/Controls.tsx` | next line `{ value: 'yesterday', label: 'Yesterday' },` | next line `{ value: 'next_24h', label: 'Next 24h' },` |
| `git grep -n -A1 "export const PRESETS" -- src/lib/costCalculator.ts` | next line `{ label: "EV Charge", … }` | next line `{ label: "Plug-in Hybrid", kWh: 14, durationHours: 8, readyBy: "07:00" },` |
| `git grep -n -e "'controlsOpen'" -e "'costSettingsOpen'" -e "'costAllowPredicted'" -- src \| wc -l` | `0` | ≥ 3 (one `usePersistedState` each; tests may add more) |
| `npx vitest run src/__tests__/lib/cheapestWindow.test.ts -t "excludePredicted"` | `64 skipped` (no match) | 5 passed (tests 1–4 and 6 of 4.3) |
| `npx vitest run src/__tests__/lib/chartZoom.test.ts` | "No test files found" | all passed |
| `npx vitest run src/__tests__/lib/costCalculator.test.ts -t "default preset is EV Charge"` | 1 passed | still 1 passed |
| `npx vitest run` | 39 files / 665 tests passed | all passed, more tests |
| config gates (Lint, Test, Test UTC, Typecheck, Build, OpenNext build, scheduled-handler patch) | pass | pass |

The `excludePredicted` filter matches by test name, so tests 1–4 and 6 of 4.3 must keep `excludePredicted` in their names (test 5 does not need it).

### 9.2 UI scenarios (verify stage; `npm run dev`, Playwright as in 3; storage cleared unless stated)

| # | Scenario | Today (measured) | After |
|---|---|---|---|
| U1 | 390×844 fresh visit: pills in the period group | `Yesterday, Today*, Tomorrow, Next 24h` | `Next 24h*, Yesterday, Today, Tomorrow` (* = pressed) |
| U2 | 390×844: tap `Toggle period controls` | no such button; card 266 px; chart top 737 px | card ≤ 80 px; chart top at least 180 px higher than before the tap; after reload still collapsed (`eprice_controlsOpen` = `false`) |
| U3 | 390×844: tap `Zoom in` | no button; chart box `scrollWidth = clientWidth = 340`, `overflow-x: hidden` | `Scrollable price chart` region `overflow-x: auto`, `scrollWidth ≥ 2 × clientWidth − 2`; its Y tick texts (`[data-testid=y-axis-overlay] .recharts-yAxis .recharts-cartesian-axis-tick-value`; class names from `lib/cartesian/YAxis.js:147` and `CartesianAxis.js:217`) equal the main chart's Y tick texts read at 1× before the tap; after setting `scrollLeft` to its maximum the overlay ticks are still visible and the page has no horizontal scroll |
| U4 | 390×844: open the calculator | "Starting Now" 651 px below the calculator's top | ≤ 200 px; settings row shows `EV Charge · 40 kWh · 8 h · ready by 07:00`; expanding it shows `Plug-in Hybrid` as the first preset with `14 kWh · 8 h` |
| U5 | 390×844 with `page.route('**/api/prices?*')` fulfilling the real response minus every price at or after a cutoff M = the first Tallinn midnight at least 6 h after now (so predictions start at M); open the calculator, expand settings, pick `Washing Machine` (2 kWh, 2 h, no deadline), then untoggle `Use predicted prices` | no toggle; best window may use predicted slots | best window ends at or before M; hint `Official prices end 00:00` (or `tomorrow 00:00` when M is more than 24 h ahead) `— the search stops there`; note `Starting now, average and peak include predicted prices from …`; summary ends `· official prices only`; toggling back restores the earlier window |
| U6 | 1440×900 | — | no `Toggle period controls` visible; period card content visible; zoom row visible; zooming scrolls the chart only |
| U7 | VAT toggle at 390 with zoom 2× | — | prices, overlay ticks and calculator follow the VAT setting |

## 10. Decisions

Issue decisions (owner): the six items as quoted in section 1; "default when not saved" (item 6); preset values 14 kWh / 8 h / 07:00 and position first (item 3).

Spec-stage rulings (confidence test passed: no access widened, no money moved — the € figures are display-only estimates —, a quotable reason, undoable by a follow-up commit):

- **R1** One PR, one commit per item — single branch in the ledger; items 1, 4, 5, 6 share `Dashboard.tsx`, and 3/4/5 share `CostCalculator.tsx`, so separate PRs would serialize anyway.
- **R2** Stored periods are not migrated — issue: "default when not saved"; write-back means returning visitors keep `today`.
- **R3** Plug-in Hybrid first, EV Charge stays the default — "put it as first" vs item 6's "first option and default"; default pinned by `costCalculator.test.ts:51`, `useCostCalculator.test.ts:104`, `PRD.md:51`.
- **R4** Excluding predictions limits the window search only (official slots, ending where the trailing predicted slots start); the stats keep predictions and say so in a note; default allowed — issue frames it as a ready-by limit, and ready-by does not bound the stats (`cheapestWindow.ts:358-396`); slot-level fills make "first predicted slot" wrong (`cheapestWindow.ts:176,189`).
- **R5** Settings disclosure inside the open card, collapsed by default; header still collapses everything — issue's use-case sentence; item 1's scroll goal.
- **R6** Period card collapsible below `lg`, open by default, persisted, inner Chart Controls kept — "where the card in in separate line" = below `lg` (`Dashboard.tsx:196`); "users can collaps it".
- **R7** Native horizontal scroll + − / + buttons below the chart + pinned price axis; no Brush, no pinch — "horizontally scrollable"; Brush defaults (40 px, 5 px travellers); toolbar has ~81 px free at 390 px.
- **R8** Zoom levels 1/2/4/8, not persisted, centre-anchored — factor meaning varies by period length; one `usePersistedState` line if wanted later.
- **R9** Copy: `Use predicted prices`, `Official prices end {time} — the search stops there`, `No {d} window fits before predicted prices start ({time}).`, `Starting now, average and peak include predicted prices from {time}.`, `· official prices only`, `Toggle period controls`, `Toggle calculator settings`, `Scrollable price chart`, `Scroll sideways for more`, `Zoom in` / `Zoom out` — "official prices" is the app's existing term (`CostCalculator.tsx:315`).
- **R10** Tapping the Best Window card in its "no window fits" state also opens the calculator settings — the card says "Tap to adjust" (`BestWindowCard.tsx:106`) and settings now start collapsed.

Builder check (opus, xhigh), 2026-11-01: three questions and three contradictions, all settled here — the stats note and trailing-run `predictedFrom` (R4, 4.3 test 6), the card tap opening settings (R10), the summary test's `cheapestWindow={null}` (4.4), U5 using a 2 h preset and a cutoff ≥ 6 h ahead, and the `prediction.ts:101` line reference. None needed the owner.
