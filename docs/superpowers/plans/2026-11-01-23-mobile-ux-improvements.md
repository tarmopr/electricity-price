# Mobile UX Improvements Implementation Plan (#23)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this run the method is fixed: ship-plan (subagent-driven-development).

**Goal:** Six phone-first changes from issue #23: Next 24h first and default, a Plug-in Hybrid preset listed first, an option to keep predicted prices out of the best-window search, calculator settings that collapse separately from results, a collapsible period card below `lg`, and a zoomable, horizontally scrollable price chart.

**Architecture:** Each item is one commit on `feature/23-mobile-ux-improvements`, in the spec's order (section 8), with its own tests. The only logic change is in `computeRollingWindow` (`src/lib/cheapestWindow.ts`): an `excludePredicted` option that limits the window search (not the horizon stats) to official slots ending where the trailing predicted slots start (`predictedFrom`). Everything else is UI state: three new `usePersistedState` keys (`costAllowPredicted`, `costSettingsOpen`, `controlsOpen`), one component-local zoom state, and one new pure module `src/lib/chartZoom.ts`.

**Tech Stack:** Next.js App Router (React 19), TypeScript, Tailwind (static class strings only), Recharts 3.7.0, lucide-react 0.575, Vitest 4 + Testing Library (jsdom).

**Spec:** `/Users/tarmoprotsin/Development/testing-ai/electricity-price/docs/superpowers/specs/2026-11-01-23-mobile-ux-improvements-design.md` — read it with this plan. Markup and copy marked "verbatim from spec 4.x" are in the spec's code blocks and are not repeated here.

## Global Constraints

- Every commit subject ends in ` (#23)`; no commit text puts fix/fixes/closes/resolves before `#23`. Subjects are fixed in each task (spec section 8).
- Copy is fixed (spec R9), character for character: `Use predicted prices`, `Official prices end {time} — the search stops there`, `No {d} window fits before predicted prices start ({time}).`, `Starting now, average and peak include predicted prices from {time}.`, `· official prices only`, `Toggle period controls`, `Toggle calculator settings`, `Scrollable price chart`, `Scroll sideways for more`, `Zoom in`, `Zoom out`. `{time}` is always `formatTallinnDeadline(new Date(predictedFromMs), new Date(nowMs))`.
- Tailwind: only complete static class strings (AGENTS.md rule 8); a data-driven width uses inline `style` (spec 4.6).
- Keep every intent/business-logic comment (AGENTS.md rule 10); the spec names the comments that change wording (4.2, 4.5).
- New persisted keys and defaults: `costAllowPredicted` = `true`, `costSettingsOpen` = `false`, `controlsOpen` = `true`. `period` default becomes `'next_24h'`. `DEFAULT_PRESET` stays EV Charge. Zoom is not persisted. No migration of stored values (spec R2, section 5).
- Zoom levels exactly `[1, 2, 4, 8]`.
- `tsc` covers test files: a new required prop means every test props object in that commit gets it (spec 3.2).
- Per-task verification (AGENTS.md "Validation"): `npm run lint`, `npx tsc --noEmit -p .`, `npx vitest run`, `TZ=UTC npx vitest run`, `npm run build` — all pass before the commit. Do not run `npm run dev` while building (`.claude/ship-plan/blockers.md`); if the build fails once on the Google font module, rerun it once (same file).
- Tests: Tallinn wall time in a comment next to every fixed UTC instant; `toBeCloseTo` for price averages.

## Review Focus

The spec's tests leave these five inputs unexercised; each line's test is added to the owning task.

1. **The whole horizon is predicted** (official prices ended before now, e.g. a sync gap): with `excludePredicted`, `best` is null, `bestIgnoresDeadline` false, `predictedFrom` equals the first slot (now floored), stats unchanged. Test in Task 3 (cheapestWindow 7).
2. **Duration 0 or negative** with predictions present: `computeRollingWindow` returns early at `if (!(durationHours > 0)) return result;` (`cheapestWindow.ts:370`), so `predictedFrom` must be computed before that line and still be reported. Test in Task 3 (cheapestWindow 8).
3. **Ready-by earlier than the end of official prices**: the deadline already limits the search, so the "Official prices end …" hint stays hidden (`predictedFromMs < readyByLimitMs` is false). Test in Task 3 (CostCalculator 5).
4. **Best Window card tapped while it shows a load error, loading or no data**: only the "No … window fits … Tap to adjust." state opens the settings; the error state must not (spec 4.4 branch order). Test in Task 4 (Dashboard 3).
5. **Chart zoom across a data change and with no data**: zoom survives a period change (new `data`, same component) and the zoom row is absent in the "No data available" state. Tests in Task 6 (PriceChart 4 and 5).

## Code facts this plan relies on (checked 2026-11-01 on `76dd6f8`)

- `git grep -n "startIndex\|endIndex" -- src ':!src/__tests__'` → 7 matches, all in `src/lib/cheapestWindow.ts` (lines 28, 30, 243, 246, 255, 259, 260). Re-indexing them to `searchSlots` affects nothing outside that file.
- `git grep -n "computeRollingWindow(" -- src ':!src/__tests__'` → `src/lib/cheapestWindow.ts:333` (definition) and `src/lib/useCostCalculator.ts:182` (the only caller).
- `git grep -n DEFAULT_PRESET -- src` → 8 matches: `costCalculator.ts:26`; `useCostCalculator.ts:8,70,71,72,73,80`; `costCalculator.test.ts:6,52`. Nothing else reads `PRESETS[0]`.
- `git grep -n -e "PRESETS\[" -e "PRESETS.length" -- src` → `costCalculator.ts:26` and `costCalculator.test.ts:12` (`toBeGreaterThanOrEqual(3)`) only; no test depends on preset order.
- `git grep -n "lg:hidden" -- src` → `src/components/Dashboard.tsx:206` and `src/__tests__/components/Dashboard.test.tsx:138,276`. `bestWindowCopies` takes the first `.lg\:hidden` in the container; Task 5's Controls header (`lg:hidden`) renders after the Dashboard.tsx:206 wrapper in DOM order (`Dashboard.tsx:206-238`), so the helper keeps finding the card wrapper.
- Test props objects: `git grep -n -e "const defaultProps" -e "const base" -e "const openProps" -e "const baseProps" -- src/__tests__/components` → `CostCalculator.test.tsx:23` (`defaultProps`), `:43` (`openProps`), `:407` (`base`); `Controls.test.tsx:12`; `BestWindowCard.test.tsx:26`; `PriceChart.test.tsx:32`. Every `<CostCalculator` and `<Controls` render in tests spreads one of them (checked all 10 multi-line `<CostCalculator` renders at lines 151–382 and the 3 `<Controls` renders at 161–192). Outside tests each is rendered once, in `Dashboard.tsx` (`<Controls` :210, `<CostCalculator` :316, `<BestWindowCard` :137).
- `CostCalculator.test.tsx` `base` tests that query settings fields: "switches the preset to Custom when the ready-by time is edited" (:431), "… ready-by time is cleared" (:453), "… duration is edited" (:468).
- `grep -n "Appliance\|Ready by\|Washing" src/__tests__/components/Dashboard.test.tsx` → no matches.
- `PriceChart.test.tsx` and `Dashboard.test.tsx` mock `AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ReferenceLine, ReferenceArea, Line, ResponsiveContainer`; the overlay chart uses only `ResponsiveContainer, AreaChart, XAxis, YAxis, Area, Line`. `PriceChart.test.tsx` renders `AreaChart` as `<svg data-testid="area-chart">`.
- `PILL_BASE`, `PILL_INACTIVE`, `PILL_ACTIVE_INDIGO` exist in `src/lib/styles.ts`.
- Baseline: `npx vitest run` → `39 passed (39)` files, `665 passed (665)` tests; `npx vitest run src/__tests__/lib/cheapestWindow.test.ts -t "excludePredicted"` → `64 skipped`.

## File map

| File | Tasks | Responsibility |
|---|---|---|
| `src/components/Controls.tsx` | 1, 5 | pill order; collapsible card below `lg` |
| `src/components/Dashboard.tsx` | 1, 3, 4, 5 | period default; wiring of new hook fields and `controlsOpen`; card tap opens settings |
| `src/lib/costCalculator.ts` | 2 | Plug-in Hybrid preset, `EV_CHARGE` const |
| `src/lib/cheapestWindow.ts` | 3 | `excludePredicted`, `predictedFrom` |
| `src/lib/useCostCalculator.ts` | 3, 4 | `costAllowPredicted`, `predictedFromMs`, `costSettingsOpen` |
| `src/components/CostCalculator.tsx` | 3, 4 | prices toggle, hint, note, no-window copy; settings disclosure |
| `src/components/BestWindowCard.tsx` | 3 | "before predicted prices start" copy |
| `src/lib/chartZoom.ts` (new) | 6 | zoom levels, scroll anchoring (pure) |
| `src/components/PriceChart.tsx` | 6 | scroll box, overlay Y axis, zoom row |
| `README.md`, `docs/PRD.md`, `AGENTS.md` | 7 | docs |

Tests mirror source under `src/__tests__/`.

---

### Task 1: Next 24h first and default

Tier: mechanical — exact reorder and one default value in 2 source files, tests spelled out.

**Files:**
- Modify: `src/components/Controls.tsx:12-17` (`PRIMARY_PERIODS`)
- Modify: `src/components/Dashboard.tsx:41`
- Test: `src/__tests__/components/Controls.test.tsx`, `src/__tests__/components/Dashboard.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PRIMARY_PERIODS` order `next_24h, yesterday, today, tomorrow` (Task 5 reads labels from it).

- [ ] **Step 1: Write the failing tests**

`Controls.test.tsx` (add `within` to the testing-library import):
```tsx
it("lists Next 24h as the first period pill", () => {
    render(<Controls {...defaultProps} />);
    const pills = within(screen.getByRole("group", { name: /period selection/i })).getAllByRole("button");
    expect(pills[0]).toHaveAccessibleName("Next 24h");
});
```
`Dashboard.test.tsx`:
```tsx
it("defaults to the Next 24h period", () => {
    render(<Dashboard />);
    expect(useDashboardPrices).toHaveBeenCalledWith("next_24h", expect.any(String), expect.any(String));
    expect(screen.getByRole("button", { name: /next 24h/i })).toHaveAttribute("aria-pressed", "true");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/components/Controls.test.tsx src/__tests__/components/Dashboard.test.tsx -t "Next 24h"`
Expected: the two new tests FAIL (first pill is `Yesterday`; called with `"today"`).

- [ ] **Step 3: Implement** — move `{ value: 'next_24h', label: 'Next 24h' }` to the top of `PRIMARY_PERIODS` (others keep their order); `usePersistedState<Period>('period', 'next_24h')` in `Dashboard.tsx:41`.

- [ ] **Step 4: Run the tests to verify they pass** — same command; Expected: all PASS.

- [ ] **Step 5: Verify** — the Global Constraints verification list; all pass.

- [ ] **Step 6: Commit**
```bash
git add src/components/Controls.tsx src/components/Dashboard.tsx src/__tests__/components/Controls.test.tsx src/__tests__/components/Dashboard.test.tsx
git commit -m "feat(controls): make Next 24h the first and default period (#23)"
```

---

### Task 2: Plug-in Hybrid preset listed first

Tier: mechanical — the spec gives the exact code (4.2) for one source file; two tests spelled out.

**Files:**
- Modify: `src/lib/costCalculator.ts:16-26`
- Test: `src/__tests__/lib/costCalculator.test.ts`, `src/__tests__/components/CostCalculator.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PRESETS[0]` = `{ label: "Plug-in Hybrid", kWh: 14, durationHours: 8, readyBy: "07:00" }`; `DEFAULT_PRESET` still `{ label: "EV Charge", kWh: 40, durationHours: 8, readyBy: "07:00" }`.

- [ ] **Step 1: Write the failing tests**

`costCalculator.test.ts`, in the presets `describe`:
```ts
it("lists Plug-in Hybrid first (14 kWh, 8 h, ready by 07:00)", () => {
  expect(PRESETS[0]).toEqual({ label: "Plug-in Hybrid", kWh: 14, durationHours: 8, readyBy: "07:00" });
});
```
`CostCalculator.test.tsx`, first `describe`:
```tsx
it("selecting the Plug-in Hybrid preset sets 14 kWh, 8 h and 07:00", () => {
  const setActivePreset = vi.fn(), setConsumptionKwh = vi.fn(), setDurationHours = vi.fn(), setReadyBy = vi.fn();
  render(<CostCalculator {...openProps} setActivePreset={setActivePreset} setConsumptionKwh={setConsumptionKwh}
    setDurationHours={setDurationHours} setReadyBy={setReadyBy} />);
  const pill = screen.getByText("Plug-in Hybrid").closest("button")!;
  expect(within(pill).getByText("14 kWh · 8 h")).toBeInTheDocument();
  fireEvent.click(pill);
  expect(setActivePreset).toHaveBeenCalledWith("Plug-in Hybrid");
  expect(setConsumptionKwh).toHaveBeenCalledWith(14);
  expect(setDurationHours).toHaveBeenCalledWith(8);
  expect(setReadyBy).toHaveBeenCalledWith("07:00");
});
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/__tests__/lib/costCalculator.test.ts src/__tests__/components/CostCalculator.test.tsx -t "Plug-in Hybrid"`; Expected: 2 FAIL.

- [ ] **Step 3: Implement** — verbatim from spec 4.2: `const EV_CHARGE: ConsumptionPreset`, Plug-in Hybrid first then `EV_CHARGE` then the four existing presets unchanged, `DEFAULT_PRESET = EV_CHARGE` with the new doc comment. The `// Overnight appliances …` comment stays directly above `PRESETS`.

- [ ] **Step 4: Run to verify they pass** — same command, plus `npx vitest run src/__tests__/lib/costCalculator.test.ts -t "default preset is EV Charge"` → 1 passed.

- [ ] **Step 5: Verify** — Global Constraints list.

- [ ] **Step 6: Commit**
```bash
git add src/lib/costCalculator.ts src/__tests__/lib/costCalculator.test.ts src/__tests__/components/CostCalculator.test.tsx
git commit -m "feat(calculator): add a Plug-in Hybrid preset listed first (#23)"
```

---

### Task 3: Option to exclude predicted prices from the best window

Tier: complex — new search semantics in `computeRollingWindow` plus wiring across the hook, two components and Dashboard; the trailing-run boundary is subtle (spec 3.2, R4).

**Files:**
- Modify: `src/lib/cheapestWindow.ts:265-400`
- Modify: `src/lib/useCostCalculator.ts:70-74,178-211`
- Modify: `src/components/CostCalculator.tsx` (props, inputs grid after "Ready by" at :277-307, estimates block :332-362, no-window line :375-379)
- Modify: `src/components/BestWindowCard.tsx` (props, `!window` branch at :98-105)
- Modify: `src/components/Dashboard.tsx:108-154,316-338`
- Test: `src/__tests__/lib/cheapestWindow.test.ts`, `src/__tests__/lib/useCostCalculator.test.ts`, `src/__tests__/components/CostCalculator.test.tsx`, `src/__tests__/components/BestWindowCard.test.tsx`, `src/__tests__/components/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `formatTallinnDeadline(deadline: Date, now: Date): string` (`@/lib/timezone`); `PILL_BASE`, `PILL_INACTIVE`, `PILL_ACTIVE_INDIGO` (`@/lib/styles`).
- Produces:
  - `RollingWindowOptions.excludePredicted?: boolean`; `RollingWindowResult.predictedFrom: Date | null` (doc comments verbatim from spec 4.3).
  - `useCostCalculator` returns `costAllowPredicted: boolean`, `setCostAllowPredicted: (v: boolean) => void`, `predictedFromMs: number | null`.
  - `CostCalculatorProps`: `allowPredicted: boolean; setAllowPredicted: (val: boolean) => void;` (required), `predictedFromMs?: number | null` (default `null`). Task 4's summary reads `allowPredicted`.
  - `BestWindowCardProps`: `excludesPredicted?: boolean` (default `false`), `predictedFromMs?: number | null` (default `null`).

- [ ] **Step 1: Write the failing `cheapestWindow` tests**

In `describe("computeRollingWindow")`, using `hourlyFromTallinn` (`now = new Date(points[0].timestamp)`, 20:00 Tallinn 14 Jun 2024 EEST unless stated). Names 1–4 and 6 must contain `excludePredicted` (acceptance filter, spec 9.1):

1. `"excludePredicted: the search ends where predicted prices start"` — `[9, 9, 9, 9, 1, 1, 9]`, predictedFrom 4, 2 h, `readyBy: null`, `excludePredicted: true` → `best.averagePrice` ≈ 9, `best.startTimestamp` `"2024-06-14T17:00:00.000Z"`, `isPredicted` false, `predictedFrom.toISOString()` `"2024-06-14T21:00:00.000Z"` (00:00), `horizonAvgPrice` ≈ 47/7, `horizonMaxPrice` 9.
2. `"excludePredicted: no window when official prices are shorter than the duration"` — `[9, 9, 1, 1, 1, 1]`, predictedFrom 2, 4 h → `best` null, `bestIgnoresDeadline` false, `predictedFrom` `"2024-06-14T19:00:00.000Z"` (22:00), `horizonAvgPrice` ≈ 22/6.
3. `"excludePredicted: a later ready-by is capped where predictions start"` — `[5, 5, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1]`, predictedFrom 4, 2 h, `readyBy: "07:00"` → `best.startTimestamp` `"2024-06-14T19:00:00.000Z"` (22:00), `endTimestamp` `"2024-06-14T21:00:00.000Z"` (00:00), average ≈ 3, `bestIgnoresDeadline` false.
4. `"excludePredicted: the deadline fallback stays on official prices"` — `[9, 9, 2, 2, 1, 1]`, predictedFrom 4, 2 h, `readyBy: "21:00"` (1 h away = half the duration, not rolled over) → best 22:00–00:00 (`"2024-06-14T19:00:00.000Z"`–`"2024-06-14T21:00:00.000Z"`), average ≈ 2, `bestIgnoresDeadline` true, `isPredicted` false. Same input without `excludePredicted` → `best.startTimestamp` `"2024-06-14T21:00:00.000Z"`, average ≈ 1.
5. `"predictedFrom is null when every slot is official"` — `[1, 2, 3]`, 1 h → `predictedFrom` null.
6. `"excludePredicted: a filled gap inside official prices is skipped, not where official prices end"` — points built inline, exactly as spec 4.3 test 6 (15-min official points k = 0…11 from `Date.UTC(2024, 5, 14, 17)` except k = 2, price 1 for k = 3, 4 else 5; predicted hourly points `"2024-06-14T20:00:00.000Z"` and `"2024-06-14T21:00:00.000Z"` at price 0), 0.5 h, no ready-by → `best.startTimestamp` `"2024-06-14T17:45:00.000Z"` (20:45), average ≈ 1, `isPredicted` false, `predictedFrom` `"2024-06-14T20:00:00.000Z"` (23:00).
7. (Review Focus 1) `"excludePredicted: no window when the whole horizon is predicted"` — `[3, 2, 1]`, predictedFrom 0, 1 h → `best` null, `bestIgnoresDeadline` false, `predictedFrom` `"2024-06-14T17:00:00.000Z"` (20:00), `horizonAvgPrice` ≈ 2.
8. (Review Focus 2) `"reports predictedFrom even when the duration is zero"` — `[1, 1, 1]`, predictedFrom 2, `durationHours: 0`, `excludePredicted: true` → `best` null, `predictedFrom` `"2024-06-14T19:00:00.000Z"` (22:00).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/__tests__/lib/cheapestWindow.test.ts -t "excludePredicted|predictedFrom"`
Expected: FAIL (`predictedFrom` undefined; predicted windows chosen).

- [ ] **Step 3: Implement in `cheapestWindow.ts`**

Add the two interface fields; extend the destructuring with `excludePredicted = false`. Right after `horizon` is built, compute `trailingStart`, `predictedFrom` and `searchSlots` exactly as the spec 4.3 code block (keep both comments). Put `predictedFrom` into the `empty` object so every return (empty horizon, `durationHours <= 0`, full) carries it. Both `findCheapestSlotWindow` calls (deadline :385 and fallback :394) take `searchSlots` instead of `horizon`; the stats loops (:358-383) keep `horizon`. Add one sentence on `excludePredicted` to the `computeRollingWindow` doc comment (:329-332).

- [ ] **Step 4: Run to verify they pass** — same command plus the whole file `npx vitest run src/__tests__/lib/cheapestWindow.test.ts`; Expected: all PASS (64 existing + 8 new).

- [ ] **Step 5: Write the failing hook tests** (`useCostCalculator.test.ts`, clock 20:10 Tallinn from `beforeEach`; data `hourly("2024-06-14T17:00:00.000Z", [20, 20, 20, 2, 2, 2, 2, 2, 2, 2, 2, 9, 9, 9], 7)` — predictions from 00:00Z = 03:00 Tallinn):
  1. `"allows predicted prices by default"` → `result.current.costAllowPredicted` true.
  2. `"excluding predicted prices keeps the window on official prices"` — wait for a window, `act(() => result.current.setCostAllowPredicted(false))` → `await waitFor` `cheapestWindow` null; `costNoData` false; `predictedFromMs` = `Date.parse("2024-06-15T00:00:00.000Z")`; then `act(() => result.current.setCostDurationHours(2))` → window `"2024-06-14T20:00:00.000Z"`–`"2024-06-14T22:00:00.000Z"` (23:00–01:00), `isPredicted` false.
  3. `"persists the predicted-price choice"` → after `setCostAllowPredicted(false)`, `localStorage.getItem("eprice_costAllowPredicted")` is `"false"` (inside `waitFor`).

  Run `npx vitest run src/__tests__/lib/useCostCalculator.test.ts -t "predicted"`; Expected: the 3 new tests FAIL.

- [ ] **Step 6: Implement in `useCostCalculator.ts`** — `usePersistedState<boolean>('costAllowPredicted', true)` next to `costCalcOpen` (:74); pass `excludePredicted: !costAllowPredicted` to `computeRollingWindow` and add `costAllowPredicted` to the `useMemo` deps; return `costAllowPredicted, setCostAllowPredicted` and `predictedFromMs: rolling?.predictedFrom?.getTime() ?? null`. `costNoData` unchanged. Run the Step 5 command; Expected: PASS.

- [ ] **Step 7: Write the failing component tests**

`CostCalculator.test.tsx`: add `allowPredicted: true, setAllowPredicted: vi.fn()` to both `defaultProps` (:23) and `base` (:407). New tests in the first `describe` (`nowMs` 2024-06-04T17:00Z = 20:00 Tallinn; `predictedFromMs = new Date("2024-06-04T22:00:00.000Z").getTime()` = 01:00):
  1. `"the prices toggle flips the predicted-price option without changing the preset"` — `getByRole("button", { name: "Use predicted prices" })` has `aria-pressed="true"`; click → `setAllowPredicted` called with `false`, `setActivePreset` not called.
  2. `"names where official prices end when predictions are excluded"` — `allowPredicted={false}`, `predictedFromMs`, `readyByLimitMs={new Date("2024-06-05T04:00:00.000Z").getTime()}` (07:00) → `getByText("Official prices end 01:00 — the search stops there")`.
  3. `"no-window line blames predicted prices when they are excluded"` — as 2 plus `cheapestWindow={null}` → `getByText("No 8 h window fits before predicted prices start (01:00).")`.
  4. `"notes that the stats still include predicted prices"` — `allowPredicted={false}`, `predictedFromMs` → `getByText("Starting now, average and peak include predicted prices from 01:00.")`; rerender with `allowPredicted` true → `queryByText(/include predicted prices from/)` null.
  5. (Review Focus 3) `"hides the official-end hint when ready-by comes first"` — `allowPredicted={false}`, `predictedFromMs`, `readyByLimitMs={new Date("2024-06-04T21:00:00.000Z").getTime()}` (00:00, before 01:00) → `queryByText(/Official prices end/)` null.

`BestWindowCard.test.tsx` (`nowMs` 20:00 Tallinn 14 Jun):
  - `"says no window fits before predicted prices start when they are excluded"` — `window={null}`, `excludesPredicted`, `predictedFromMs={new Date("2024-06-14T22:00:00.000Z").getTime()}` (01:00) → `getByText("No 8 h window fits before predicted prices start (01:00). Tap to adjust.")`.

`Dashboard.test.tsx`: `makeCostCalc` gains `costAllowPredicted: true, setCostAllowPredicted: vi.fn(), predictedFromMs: null`. New:
  - `"passes the excluded-predictions state to the card"` — `makeCostCalc({ costAllowPredicted: false, predictedFromMs: Date.parse("2024-01-01T22:00:00.000Z"), cheapestWindow: null })` (00:00 Tallinn 2 Jan; `costNowMs` is 11:00) → `within(bestWindowCopies(container).mobile).getByText("No 8 h window fits before predicted prices start (00:00). Tap to adjust.")`.

Run: `npx vitest run src/__tests__/components/CostCalculator.test.tsx src/__tests__/components/BestWindowCard.test.tsx src/__tests__/components/Dashboard.test.tsx`; Expected: the new tests FAIL.

- [ ] **Step 8: Implement the components**
  - `CostCalculator.tsx`: new props as in Interfaces; the "Prices" field (markup verbatim from spec 4.3) as the fourth child of the inputs grid, after the "Ready by" block; `officialEndLabel` / `officialEndHint` exactly as spec 4.3; the no-window line (:375-379) switches copy when `!allowPredicted && predictedFromMs !== null && nowMs != null`; the stats note `<p className="text-xs text-zinc-500">` inside the `estimates.length > 0` branch, after the "Show more" button, under the same condition. Import `PILL_INACTIVE, PILL_ACTIVE_INDIGO`.
  - `BestWindowCard.tsx`: new optional props; in the final `!window` branch, when `excludesPredicted && predictedFromMs !== null && nowMs !== null` render the spec 4.3 copy with `formatTallinnDeadline(new Date(predictedFromMs), now)`; else the existing text. Error / no-data / loading branches unchanged and still first.
  - `Dashboard.tsx`: destructure `costAllowPredicted, setCostAllowPredicted, predictedFromMs`; `BestWindowCard` gets `excludesPredicted={!costAllowPredicted}` and `predictedFromMs`; `CostCalculator` gets `allowPredicted`, `setAllowPredicted`, `predictedFromMs`.

- [ ] **Step 9: Run to verify they pass** — Step 7 command; Expected: all PASS. Then `npx vitest run src/__tests__/lib/cheapestWindow.test.ts -t "excludePredicted"` → `6 passed` (spec tests 1–4, 6 and Review Focus 7; the spec's "5 passed" predates test 7).

- [ ] **Step 10: Verify** — Global Constraints list.

- [ ] **Step 11: Commit**
```bash
git add src/lib/cheapestWindow.ts src/lib/useCostCalculator.ts src/components/CostCalculator.tsx src/components/BestWindowCard.tsx src/components/Dashboard.tsx src/__tests__/lib/cheapestWindow.test.ts src/__tests__/lib/useCostCalculator.test.ts src/__tests__/components/CostCalculator.test.tsx src/__tests__/components/BestWindowCard.test.tsx src/__tests__/components/Dashboard.test.tsx
git commit -m "feat(calculator): option to exclude predicted prices from the best window (#23)"
```

---

### Task 4: Settings collapse separately from results

Tier: standard — a disclosure row following the existing calculator-toggle pattern across hook, component and Dashboard, plus test-prop updates.

**Files:**
- Modify: `src/lib/useCostCalculator.ts` (next to `costCalcOpen`)
- Modify: `src/components/CostCalculator.tsx` (props; open body :224-399)
- Modify: `src/components/Dashboard.tsx` (`openCostCalculator` :128-134, `<CostCalculator` props)
- Test: `src/__tests__/lib/useCostCalculator.test.ts`, `src/__tests__/components/CostCalculator.test.tsx`, `src/__tests__/components/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `allowPredicted` (Task 3); `formatNumber`, `formatDuration`, `snapDurationHours` (`@/lib/numericInput`); `searchedHours` already computed at `CostCalculator.tsx:99`.
- Produces: `useCostCalculator` returns `costSettingsOpen: boolean`, `setCostSettingsOpen: (v: boolean) => void`; `CostCalculatorProps` gains required `settingsOpen: boolean; setSettingsOpen: (val: boolean) => void;`.

- [ ] **Step 1: Update test props and write the failing tests**

`CostCalculator.test.tsx`: `defaultProps` and `base` get `settingsOpen: false, setSettingsOpen: vi.fn()`; `openProps` becomes `{ ...defaultProps, isOpen: true, settingsOpen: true }`; the three `base` tests that query settings (:431 ready-by edited, :453 ready-by cleared, :468 duration edited) render with `settingsOpen`. New tests (first `describe`):
  1. `"settings start collapsed to a one-line summary while results show"` — `{...openProps} settingsOpen={false}` → `queryByText("Appliance")` null; `getByRole("button", { name: "Toggle calculator settings" })` has `aria-expanded="false"`; `getByText("EV Charge · 40 kWh · 8 h · ready by 07:00")`; `getByText("Starting Now")`.
  2. `"the settings row toggles settings"` — `settingsOpen={false}`, click the row → `setSettingsOpen` called with `true`.
  3. `"summary names no deadline and official-only prices"` — `{...openProps} settingsOpen={false} activePreset="Custom" consumptionKwh={2} durationHours={2} readyBy={null} allowPredicted={false} cheapestWindow={null}` → `getByText("Custom · 2 kWh · 2 h · no deadline · official prices only")`.
  4. `"results stay visible with settings open"` — `openProps` → `getByText("Appliance")` and `getByText("Starting Now")`.

`useCostCalculator.test.ts`: `"settings start collapsed and persist"` → `costSettingsOpen` false; after `act(() => result.current.setCostSettingsOpen(true))`, `localStorage.getItem("eprice_costSettingsOpen")` is `"true"` (in `waitFor`).

`Dashboard.test.tsx`: `makeCostCalc` gains `costSettingsOpen: false, setCostSettingsOpen: vi.fn()`. The existing "tapping the Best Window card opens the cost calculator" test also passes a `setCostSettingsOpen = vi.fn()` and asserts `not.toHaveBeenCalled()`. New, with the same `requestAnimationFrame` spy and `scrollIntoView` stub as that test:
  1. `"tapping the card when no window fits opens the settings too"` — `makeCostCalc({ cheapestWindow: null, setCostCalcOpen, setCostSettingsOpen })`, click the mobile copy's `/open cost calculator/i` button → `setCostCalcOpen` called with `true`, `setCostSettingsOpen` called with `true`.
  2. (Review Focus 4) `"tapping the card in its load-error state leaves the settings alone"` — `makeCostCalc({ cheapestWindow: null, costError: "boom", setCostCalcOpen, setCostSettingsOpen })` → `setCostCalcOpen` called with `true`, `setCostSettingsOpen` not called.

Run: `npx vitest run src/__tests__/components/CostCalculator.test.tsx src/__tests__/components/Dashboard.test.tsx src/__tests__/lib/useCostCalculator.test.ts`; Expected: new tests FAIL.

- [ ] **Step 2: Implement**
  - `useCostCalculator.ts`: `usePersistedState<boolean>('costSettingsOpen', false)`, returned next to `costCalcOpen`.
  - `CostCalculator.tsx`: new props; disclosure row (markup verbatim from spec 4.4, import `SlidersHorizontal`) as the first element of the open body; today's "Appliance" block and the inputs grid (with Task 3's Prices field) move inside `{settingsOpen && (<div className="space-y-5">…</div>)}`; `settingsSummary` exactly as spec 4.4 (one template string, shown only while collapsed). The results block (predicted note through savings) is unchanged and follows.
  - `Dashboard.tsx`: destructure `costSettingsOpen, setCostSettingsOpen`; pass `settingsOpen` / `setSettingsOpen`; in `openCostCalculator`, after `setCostCalcOpen(true)`, call `setCostSettingsOpen(true)` only when `cheapestWindow === null && !costLoading && costError === null && !costNoData`; add those four values and `setCostSettingsOpen` to the `useCallback` deps.

- [ ] **Step 3: Run to verify they pass** — Step 1 command; Expected: all PASS.

- [ ] **Step 4: Verify** — Global Constraints list.

- [ ] **Step 5: Commit**
```bash
git add src/lib/useCostCalculator.ts src/components/CostCalculator.tsx src/components/Dashboard.tsx src/__tests__/lib/useCostCalculator.test.ts src/__tests__/components/CostCalculator.test.tsx src/__tests__/components/Dashboard.test.tsx
git commit -m "feat(calculator): collapse settings separately from results (#23)"
```

---

### Task 5: Collapsible period card below `lg`

Tier: standard — one new header and wrapper in Controls mirroring the calculator header, one persisted flag in Dashboard.

**Files:**
- Modify: `src/components/Controls.tsx` (props :39-95, card body :145-364)
- Modify: `src/components/Dashboard.tsx` (state near :41, `<Controls` :210-237)
- Test: `src/__tests__/components/Controls.test.tsx`, `src/__tests__/components/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `PRIMARY_PERIODS`, `MORE_PERIODS` (Controls.tsx, Task 1 order).
- Produces: `ControlsProps` gains required `isOpen: boolean; setIsOpen: (val: boolean) => void;`.

- [ ] **Step 1: Write the failing tests**

`Controls.test.tsx`: `defaultProps` gains `isOpen: true, setIsOpen: vi.fn()`. New tests (reuse `isInsideHiddenContainer`):
  1. `"collapsing hides the whole card below lg"` — `isOpen={false}` → `getByRole("button", { name: "Toggle period controls" })` has `aria-expanded="false"` and class `lg:hidden`; `isInsideHiddenContainer` is true for the `period selection` group and the `Include VAT (22%)` button; the closest ancestor with class `hidden` also has class `lg:flex`.
  2. `"collapsed header summarises period and VAT"` — `isOpen={false} period="next_24h" includeVat` → `getByText("Next 24h · incl. VAT")`; rerender `period="custom" includeVat={false}` → `getByText("Custom · excl. VAT")`.
  3. `"the header toggles the card"` — open, click the header → `setIsOpen` called with `false`.

`Dashboard.test.tsx`: `"the period card starts expanded"` → `getByRole("button", { name: "Toggle period controls" })` has `aria-expanded="true"`.

Run: `npx vitest run src/__tests__/components/Controls.test.tsx src/__tests__/components/Dashboard.test.tsx`; Expected: new tests FAIL.

- [ ] **Step 2: Implement**
  - `Controls.tsx`: new props; header button (markup verbatim from spec 4.5, import `CalendarClock`) as the card's first child; `periodSummary` = `` `${label} · ${includeVat ? "incl. VAT" : "excl. VAT"}` `` with `label` looked up in `[...PRIMARY_PERIODS, ...MORE_PERIODS]`; everything else in the card (period/VAT row, Chart Controls toggle, collapsible overlays/alert) goes into one wrapper with ``className={`${isOpen ? "flex" : "hidden"} lg:flex flex-col mt-3 lg:mt-0`}``; the inner Period `Label` (:153) gets `hidden lg:block` appended to its className; the comments at :148 and :234 change wording exactly as spec 4.5.
  - `Dashboard.tsx`: `const [controlsOpen, setControlsOpen] = usePersistedState<boolean>('controlsOpen', true);` passed as `isOpen` / `setIsOpen`.

- [ ] **Step 3: Run to verify they pass** — Step 1 command; Expected: all PASS, including the unchanged "period pills and VAT toggle are visible on mobile without expanding Chart Controls" and Dashboard's "renders one card copy per breakpoint …".

- [ ] **Step 4: Verify** — Global Constraints list.

- [ ] **Step 5: Commit**
```bash
git add src/components/Controls.tsx src/components/Dashboard.tsx src/__tests__/components/Controls.test.tsx src/__tests__/components/Dashboard.test.tsx
git commit -m "feat(controls): collapsible period card on small screens (#23)"
```

---

### Task 6: Chart zoom and horizontal scroll

Tier: complex — two Recharts charts must share one Y scale behind a sticky overlay, with scroll anchoring through a layout effect; jsdom mocks Recharts, so alignment is only checked in the UI scenarios.

**Files:**
- Create: `src/lib/chartZoom.ts`
- Modify: `src/components/PriceChart.tsx` (hooks :283-292, main return :410-603)
- Test: `src/__tests__/lib/chartZoom.test.ts` (new), `src/__tests__/components/PriceChart.test.tsx`

**Interfaces:**
- Consumes: `PILL_BASE`, `PILL_INACTIVE` (`@/lib/styles`); `ZoomIn`, `ZoomOut` (lucide-react).
- Produces (`src/lib/chartZoom.ts`, signatures and doc comments verbatim from spec 4.6):
  - `export const ZOOM_LEVELS = [1, 2, 4, 8] as const;` `export type ZoomLevel = (typeof ZOOM_LEVELS)[number];`
  - `nextZoomLevel(level: ZoomLevel): ZoomLevel`, `prevZoomLevel(level: ZoomLevel): ZoomLevel`
  - `anchoredScrollLeft(scrollLeft: number, clientWidth: number, oldZoom: number, newZoom: number): number`

- [ ] **Step 1: Write the failing `chartZoom` tests** — `src/__tests__/lib/chartZoom.test.ts`:
  - `nextZoomLevel`: 1→2, 2→4, 4→8, 8→8; `prevZoomLevel`: 8→4, 4→2, 2→1, 1→1.
  - `anchoredScrollLeft(0, 340, 1, 2)` = 170; `(170, 340, 2, 4)` = 510; `(510, 340, 4, 2)` = 170; `(170, 340, 2, 1)` = 0; `(1020, 340, 4, 8)` = 2210; `(2380, 340, 8, 8)` = 2380 (at the end, unchanged); `(5000, 340, 2, 4)` = 1020 (clamped to `340 × 3`); `(100, 0, 1, 2)` = 0.

  Run `npx vitest run src/__tests__/lib/chartZoom.test.ts`; Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/lib/chartZoom.ts`** — formula and clamp from spec 4.6; `clientWidth <= 0` returns 0. Run Step 1 command; Expected: PASS.

- [ ] **Step 3: Write the failing `PriceChart` tests** (import `fireEvent`):
  1. `"at 1× the chart is not scrollable"` — `Zoom out` disabled; `queryByRole("region", { name: "Scrollable price chart" })` null; `getAllByTestId("area-chart")` length 1; `getByText("1×")`; `getByRole("img", { name: /electricity price chart/i }).parentElement!.style.width` is `"100%"`.
  2. `"zoom in widens the chart and pins the price axis"` — click `Zoom in` → that `parentElement!.style.width` is `"200%"`; `getByRole("region", { name: "Scrollable price chart" })` has `tabindex="0"`; `getByTestId("y-axis-overlay")`; `getAllByTestId("area-chart")` length 2; `getByText("2×")`; `getByText("Scroll sideways for more")`.
  3. `"zoom stops at 8×"` — three clicks on `Zoom in` → `8×`, `Zoom in` disabled; one click on `Zoom out` → `4×`.
  4. (Review Focus 5) `"keeps the zoom when the data changes"` — zoom to `2×`, `rerender` with different `data` (e.g. the predicted-mix array) → still `2×` and width `"200%"`.
  5. (Review Focus 5) `"shows no zoom controls without data"` — `data={[]}` → `queryByRole("button", { name: "Zoom in" })` null.

  Run `npx vitest run src/__tests__/components/PriceChart.test.tsx`; Expected: new tests FAIL.

- [ ] **Step 4: Implement in `PriceChart.tsx`**
  - Above the early returns (Rules of Hooks, comment at :290): `useState<ZoomLevel>(1)`, `scrollRef = useRef<HTMLDivElement>(null)`, `pendingScroll = useRef<number | null>(null)`, and a `useLayoutEffect` on `[zoom]` that applies and clears `pendingScroll`. `changeZoom(next: ZoomLevel)` records `anchoredScrollLeft(el.scrollLeft, el.clientWidth, zoom, next)` when `scrollRef.current` exists, then `setZoom(next)`.
  - Main return: the structure, overlay chart and zoom-controls row verbatim from spec 4.6. The existing `role="img"`, `aria-label` and `WebkitTapHighlightColor` move from the outer div to the inner `flex-1` div; the outer frame keeps `w-full h-[300px] sm:h-[400px] mt-4 relative overflow-hidden`.
  - Main chart `YAxis`: `tick={zoom > 1 ? false : { fill: '#71717a', fontSize: 12 }}`; nothing else in the main chart changes. The overlay's Y-axis props and series mirror the main chart's (domain `[calculatedMin, 'auto']`, `allowDataOverflow`, same areas and overlay lines).
  - Loading and "No data available" returns unchanged (no zoom row).

- [ ] **Step 5: Run to verify they pass** — `npx vitest run src/__tests__/components/PriceChart.test.tsx src/__tests__/components/Dashboard.test.tsx`; Expected: all PASS.

- [ ] **Step 6: Verify** — Global Constraints list.

- [ ] **Step 7: Commit**
```bash
git add src/lib/chartZoom.ts src/components/PriceChart.tsx src/__tests__/lib/chartZoom.test.ts src/__tests__/components/PriceChart.test.tsx
git commit -m "feat(chart): zoom and scroll the price chart horizontally (#23)"
```

---

### Task 7: Docs

Tier: standard — prose in three files; the spec lists every point to cover (section 6) but not the wording.

**Files:**
- Modify: `README.md:12,13,15`
- Modify: `docs/PRD.md` (3.2 at :17-26; 3.3 :28-29; 3.5 :49-58)
- Modify: `AGENTS.md` (Coding Conventions rule 5)

**Interfaces:** none.

- [ ] **Step 1: Edit** — exactly the points in spec section 6: README Features (Periods, Price chart, Cost calculator lines); PRD 3.2 new "Zoom & Scroll" bullet, 3.3 Timeframe (Next 24h first; default for first-time visitors — replaces "Today is the default.") and Mobile Layout (whole card collapses below `lg`), 3.5 Rolling Horizon, Inputs (presets list with Plug-in Hybrid first and EV Charge still "the default", prices toggle), new "Settings" bullet, Ready-by Rules, Persistence (settings open state, predicted-price choice); AGENTS.md rule 5 gets the sentence quoted in spec section 6, verbatim.

- [ ] **Step 2: Verify** — `git grep -n "Today is the default" -- docs/PRD.md` → no match; `git grep -n "costAllowPredicted" -- AGENTS.md` → 1 match; `git grep -n "Plug-in Hybrid" -- README.md docs/PRD.md` → ≥ 2 matches. Docs-only change: no build needed.

- [ ] **Step 3: Commit**
```bash
git add README.md docs/PRD.md AGENTS.md
git commit -m "docs: describe the mobile UX changes (#23)"
```

---

## Scenarios (for verify-and-fix)

No `## Evidence` in `.claude/ship-plan.md`, so there are no deployed-environment rows. Local rows use `## UI testing`: `npm run dev` at http://localhost:3000, widths 390 px (context `{ viewport: 390×844, isMobile: true, hasTouch: true, timezoneId: 'Europe/Tallinn' }`) and 1440 px (1440×900); Claude in Chrome if available, otherwise Playwright `playwright-core@1.48.2` + installed Chrome (`.claude/ship-plan/blockers.md`, UI). Storage cleared before each row unless stated. Stop `npm run dev` before Build / OpenNext gates.

| # | Kind | Scenario / command | Baseline (spec 3, measured on `6e6e5b7`) | Pass when |
|---|---|---|---|---|
| B0 | unit | `npx vitest run` | `39 passed (39)` files, `665 passed (665)` tests | all pass, more tests; also under `TZ=UTC` |
| T1 | unit | `npx vitest run src/__tests__/lib/cheapestWindow.test.ts -t "excludePredicted"` | `64 skipped` | `6 passed` |
| T2 | unit | `npx vitest run src/__tests__/lib/chartZoom.test.ts` | No test files found | all pass |
| T3 | unit | `npx vitest run src/__tests__/lib/costCalculator.test.ts -t "default preset is EV Charge"` | 1 passed | 1 passed |
| T4 | unit | `git grep -n -e "'controlsOpen'" -e "'costSettingsOpen'" -e "'costAllowPredicted'" -- src \| wc -l` | `0` | ≥ 3 |
| T5 | unit | spec 9.1 `git grep` rows for `PRIMARY_PERIODS`, `PRESETS`, the period default | first pill `yesterday`, first preset EV Charge, default `'today'` | `next_24h`, Plug-in Hybrid, `'next_24h'` |
| U1 | local 390 | fresh visit: pills in the `Period selection` group | `Yesterday, Today*, Tomorrow, Next 24h` | `Next 24h*, Yesterday, Today, Tomorrow` (* = `aria-pressed=true`) |
| U2 | local 390 | tap `Toggle period controls` | no such button; card 266 px; chart top 737 px | card ≤ 80 px; chart top ≥ 180 px higher; after reload still collapsed, `eprice_controlsOpen` = `false` |
| U3 | local 390 | tap `Zoom in` | no button; chart box `scrollWidth = clientWidth = 340`, `overflow-x: hidden` | region `Scrollable price chart` has `overflow-x: auto`, `scrollWidth ≥ 2 × clientWidth − 2`; overlay Y tick texts (`[data-testid=y-axis-overlay] .recharts-yAxis .recharts-cartesian-axis-tick-value`) equal the main chart's ticks read at 1× before the tap; at max `scrollLeft` the overlay ticks are still visible and the page has no horizontal scroll |
| U4 | local 390 | open the calculator | "Starting Now" 651 px below the calculator top | ≤ 200 px; settings row shows `EV Charge · 40 kWh · 8 h · ready by 07:00`; expanded, first preset is `Plug-in Hybrid` with `14 kWh · 8 h` |
| U5 | local 390 | `page.route('**/api/prices?*')` returns the real response minus every price at or after M = first Tallinn midnight ≥ 6 h after now; open calculator, expand settings, pick `Washing Machine`, untoggle `Use predicted prices` | no toggle | best window ends ≤ M; hint `Official prices end 00:00 — the search stops there` (or `tomorrow 00:00` when M is > 24 h ahead); note `Starting now, average and peak include predicted prices from …`; summary ends `· official prices only`; toggling back restores the earlier window |
| U6 | local 1440 | desktop layout | — | no visible `Toggle period controls`; period card content visible; zoom row visible; zooming scrolls only the chart |
| U7 | local 390 | VAT toggle with zoom 2× | — | chart prices, overlay ticks and calculator follow the VAT setting |

## Close-out notes for ship-plan

Pre-flight questions: none

Merge: **do not merge.** Merging to `main` deploys production (Workers Builds runs `npm run deploy:ci` on push to `main`, AGENTS.md "Setup and Run"), and the user's global instructions say "Production promotion is always left for the user to dispatch." `## Allowed` never applies to a production-like environment. Stop at merge-ready, hand the user the merge command, and treat the merge and base-branch CI as the user's step (see the `From ship-issue` ruling).

Follow-ups:
- Deploy: after merge, Workers Builds deploys production (`npm run deploy:ci`). No `db/` change, so no migration and no `npm run recompute`. Once it finishes, rerun U1–U4 at 390 px against https://eprice.protsin.com.
- Out of scope, from spec section 7: pinch / ctrl-wheel zoom; heatmap zoom; migrating stored `today` to `next_24h`; skeleton mirroring collapsed states; tooltip at the scroll edge; browser-local `format` in `PriceChart.tsx:89,462` (AGENTS.md rule 3).

PR title: `feat: mobile UX improvements — collapsible cards, chart zoom, predicted-price option (#23)`

From ship-issue:
Ruling: checkout is the main checkout — `git status` clean on main at start — cost if wrong: none, branch is local
Ruling: spec committed on the feature branch, not held — AGENTS.md has no rule separating docs and code PRs — cost if wrong: one file move
Ruling: Models defaults (Spec opus/xhigh, Plan opus/high) — `.claude/ship-plan.md` has no `## Models` — cost if wrong: stage cost only
Ruling: environment ready — `gh auth status` "Logged in to github.com account tarmopr"; hasIssuesEnabled true; node_modules present; main last 3 CI runs `completed success` (41335930354 latest); no open milestones (API length 0) so no milestone question — cost if wrong: a gate fails at pre-flight
Lesson: Slack tools not connected (ToolSearch "slack search channels" found none); `## Slack` absent from config and ship-plan.local.md, so no review request is posted this run — connect the Slack MCP or add `## Slack` Channel: none
Ruling: skipped brainstorming's conversation stops (first message, one question per turn, playback, visual-companion offer) — ship-issue stage runs unattended; issue.md is the requirement source — cost if wrong: a preference the owner would have stated surfaces at PR review instead
Ruling: skipped brainstorming's approval HARD-GATE and "hand over the document" stop; spec written to the ledger's Spec path — ship-issue overrides both — cost if wrong: none
Ruling: sized as a project with a written design — six items across 9 source files plus 3 docs — cost if wrong: spec longer than needed
Ruling: R1 one PR, one commit per item plus a docs commit (order checked: each commit builds from itself and earlier ones) — items 1/4/5/6 share Dashboard.tsx and 3/4/5 share CostCalculator.tsx; the ledger names a single branch — cost if wrong: a larger PR to review
Ruling: R2 Next 24h becomes first pill and default, stored periods not migrated — issue: "default when not saved"; usePersistedState.ts:49-56 writes the default back on hydrate (a fresh visit stored eprice_period "today"), so returning visitors keep Today — cost if wrong: a follow-up one-time migration (precedent migrateLegacyReadyBy, useCostCalculator.ts:40-56)
Ruling: R3 Plug-in Hybrid (14 kWh, 8 h, 07:00) listed first, EV Charge stays DEFAULT_PRESET — item 3 says only "put it as first" while item 6 says "first option and default"; the default is pinned by costCalculator.test.ts:51, useCostCalculator.test.ts:104 and PRD.md:51 — cost if wrong: a one-line change, though first-time visitors in between keep EV Charge stored
Ruling: R4 "Use predicted prices" (persisted costAllowPredicted, default true) limits only the window search: official slots only, ending where the trailing predicted slots start (predictedFrom). Starting Now, average and peak keep predicted prices and a note says so — issue: "exclude the predicted price range from the cheapest window", framed as a ready-by limit; ready-by does not bound the stats (cheapestWindow.ts:358-396); slot fills marked predicted mid-data (cheapestWindow.ts:176,189) rule out using the first predicted slot — cost if wrong: one slice changed in computeRollingWindow
Ruling: R5 settings get their own disclosure row inside the open calculator, collapsed by default (persisted costSettingsOpen); the header still collapses everything; results always show while the card is open — issue: "quickly see the comparison, and not change the settigs"; at 390 px "Starting Now" sits 651 px below the calculator top today — cost if wrong: a UI follow-up commit
Ruling: R6 the period card collapses below lg (Dashboard.tsx:196 grid-cols-1 lg:grid-cols-3) to a "Period · {label} · incl./excl. VAT" header, open by default (persisted controlsOpen); the inner Chart Controls toggle stays — issue: "where the card in in separate line", "users can collaps it"; card measures 266 px at 390 px — cost if wrong: a UI follow-up commit
Ruling: R7 chart zoom is native horizontal scroll inside the chart box, − / + buttons below the chart (1/2/4/8×) and a sticky Y-axis overlay chart; no Recharts Brush and no pinch — issue: "horizontally scrollable"; RechartsWrapper.js:304-312 does not block touch scroll; Brush defaults to height 40 and 5 px travellers (Brush.d.ts); the toolbar has ~81 px free at 390 px — cost if wrong: a PriceChart follow-up commit
Ruling: R8 zoom is not persisted, survives period changes, keeps the viewport centre (anchoredScrollLeft in a new src/lib/chartZoom.ts) — a zoom factor means different spans per period — cost if wrong: one usePersistedState line
Ruling: R9 all copy fixed in the spec ("Use predicted prices", "Official prices end {time} — the search stops there", "No {d} window fits before predicted prices start ({time}).", "Starting now, average and peak include predicted prices from {time}.", "· official prices only", "Toggle period controls", "Toggle calculator settings", "Scrollable price chart", "Scroll sideways for more", "Zoom in"/"Zoom out") — "official prices" is the app's term (CostCalculator.tsx:315) — cost if wrong: text edits
Ruling: R10 tapping the Best Window card in its "no window fits" state also opens the calculator settings — the card says "Tap to adjust" (BestWindowCard.tsx:106) and settings now start collapsed — cost if wrong: one condition in openCostCalculator
Ruling: builder check (opus, xhigh) returned 3 questions and 3 contradictions; all were settled in the spec (R4 stats note and trailing-run predictedFrom with a new gap test, R10, the summary test now passes cheapestWindow={null}, U5 now uses a 2 h preset and a cutoff at least 6 h ahead, the prediction.ts:101 line ref); none needed the owner — builder report — cost if wrong: Plan stage re-rules
Lesson: no PR is named by the issue, spec or ledger, there are no open PRs, and origin/main is still 6e6e5b7 (branch has no extra commits): nothing moved — PR re-check step
Lesson: `.claude/ship-plan.md` has no `## Evidence`, so the baseline was measured on local `npm run dev` with Playwright (playwright-core 1.48.2 in the scratchpad) at 390×844 and 1440×900. A read-only localhost Evidence row would let later stages rerun the same measurements — config setup
Lesson: usePersistedState writes every default back on first hydrate, so any issue that asks for a new default only reaches first-time visitors. This is worth a line in AGENTS.md Gotchas — caught by reading localStorage after a fresh-visit probe
Lesson: the first draft took "first slot with isPredicted" to mean "official prices end", but normalizeTo15MinSlots marks fill slots inside official data as predicted — caught by the builder check; reading the flag's producer (cheapestWindow.ts:176,189) before using it as a boundary would have caught it earlier
Ruling: I3 batch empty, nothing asked — Spec stage returned "Questions: none"; Slack tools not connected so no channel question; pre-flight permission items already covered by blockers.md entries — cost if wrong: ship-plan's pre-flight asks instead
Ruling: skipped writing-plans' "Execution Handoff" stop (plan review + method choice); method fixed to ship-plan (subagent-driven-development) — ship-issue Plan-stage prompt: "Its plan review and its execution-method choice are overridden by ship-issue" — cost if wrong: none
Ruling: added 5 Review Focus tests beyond the spec (all-predicted horizon, duration 0 still reports predictedFrom, ready-by before official end hides hint, card tap in error state leaves settings closed, zoom kept across data change / absent without data) — writing-plans requires one test per Review Focus line; `cheapestWindow.ts:370` `if (!(durationHours > 0)) return result;` runs before the search, so predictedFrom must go in `empty` — cost if wrong: drop up to 8 test cases
Ruling: acceptance `-t "excludePredicted"` now expects 6 passed, not the spec's 5 — the added all-predicted test is named with `excludePredicted` — cost if wrong: one test renamed
Ruling: CostCalculator.test.tsx `base` gets `settingsOpen: false` (spec), and its three tests that query settings (:431 ready-by edited, :453 cleared, :468 duration edited) pass `settingsOpen` — spec 4.4; `git grep -n "const base" -- src/__tests__/components` → CostCalculator.test.tsx:407 only — cost if wrong: test-prop edits
Ruling: Dashboard `bestWindowCopies` (first `.lg\:hidden`) stays valid after Task 5 adds a `lg:hidden` Controls header — `git grep -n "lg:hidden" -- src` → only Dashboard.tsx:206 and two test lines; Controls renders after that wrapper (Dashboard.tsx:206-238) — cost if wrong: one test helper selector
Ruling: every task runs the full AGENTS.md validation (lint, tsc, vitest, TZ=UTC vitest, npm run build) before its commit; docs task runs greps only — AGENTS.md "Validation (required after every code change)" — cost if wrong: slower tasks
Ruling: tiers — T1, T2 mechanical; T4, T5, T7 standard; T3, T6 complex — config-format.md "Task tiers" — cost if wrong: model cost or an extra fix round
Ruling: commit subjects copied from spec section 8, all end ` (#23)`, no closing keyword — `grep -i -E "(fix|fixes|closes|resolves) #23"` on the plan → no match — cost if wrong: none
Ruling: Plan stage Q1 (merge deploys production) ruled, not asked: the run stops at merge-ready and the user merges — global CLAUDE.md "Production promotion is always left for the user to dispatch"; AGENTS.md "Production deploys via Workers Builds"; ship-issue "A deploy in particular is never part of the run … never a question"; config-format `## Allowed` never applies a production-like name — cost if wrong: the user runs one `gh pr merge` command
Lesson: `.claude/ship-plan.md` `## CI` has no `Merge deploys to:` line, but a merge to main deploys production through Workers Builds, so ship-plan's merge rule never sees the production deploy — config setup: add `Merge deploys to: production` to `## CI`
Lesson: spec section 4.6 says "as noted at `PriceChart.tsx:291`", but the Rules-of-Hooks comment is at :290 (:291 is the `useMemo`). The plan uses :290 — Spec stage line-ref check
Ruling: plan appended to issue body (## Plan, ## Done when, ## Full plan; 56,842 bytes, under the 63,536 limit) and rulings comment posted (issuecomment-6562473602) — tracker *Append the plan* — cost if wrong: an issue edit
