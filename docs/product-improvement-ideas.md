# Estonia Electricity Price Dashboard — Feature & Improvement Proposals

## Context

The dashboard is a polished, dark-themed Next.js app displaying real-time Estonian electricity prices from the Elering API. It already has a strong feature set (live price widget, interactive Recharts area chart, timeframe selector, cheapest period discovery, statistical overlays, VAT toggle, price prediction, auto-refresh). This plan proposes the highest-impact additions and refinements organized by category, with a priority ranking at the end.

---

## 1. New Features

### 1.1 Price Alert Thresholds
- Configurable "cheap" / "expensive" price boundary (e.g., "notify me below 5 ¢/kWh")
- Notification bar appears when current price crosses a threshold; optional browser Web Notification for background tabs
- Persist thresholds in `localStorage`; check inside existing 15-min polling in `Dashboard.tsx`
- **Why:** Most requested feature for electricity apps — makes the dashboard passively useful without active monitoring
- **Complexity:** Medium

### 1.2 Cost Calculator / Consumption Estimator
- Expandable card where users input consumption (e.g., "EV charge = 40 kWh") and see estimated cost at cheapest window vs. now vs. peak
- Reuses existing `cheapestAverage` and `stats` data — no new API calls
- **Why:** Transforms abstract ¢/kWh into real euros, directly answering "how much will this cost me?"
- **Complexity:** Low–Medium

### 1.3 Multi-Region Comparison (Baltic States) - DO NOT IMPLEMENT
- The Elering API already returns `data.fi`, `data.lv`, `data.lt` alongside `data.ee` — currently discarded
- Add a region selector and overlay a second line on the chart for comparison
- **Why:** Free data already in the API response; cross-border comparison valuable for border residents and analysts
- **Complexity:** Medium | **Files:** `api.ts` (line ~103), `PriceChart.tsx`, `Controls.tsx`

### 1.4 Persistent User Preferences (localStorage)
- Save VAT toggle, default timeframe, overlay selections, cheapest period config across sessions
- Custom `usePersistedState` hook or `useEffect` read/write on the ~17 state variables in `Dashboard.tsx`
- **Why:** Currently every page load resets to defaults — major friction for daily users
- **Complexity:** Low

### 1.5 Price Heatmap View
- Alternative 24-column (hours) × N-row (days) grid where cell color encodes price level
- Powerful for weekly/monthly timeframes to reveal daily price patterns at a glance
- **Why:** Area chart is hard to parse for multi-day ranges; heatmaps enable instant pattern recognition
- **Complexity:** High (Recharts lacks native heatmap; requires custom SVG or new library)

### 1.6 Share / Export Current View
- Share button: copies URL with encoded state params, or exports chart as PNG
- URL-based state enables bookmarking specific views
- **Why:** Users frequently share price screenshots in social media and group chats
- **Complexity:** Medium

---

## 2. UX / Usability Improvements

### 2.1 Fix "vs previous 15min" Label Bug - THIS IS NOT A BUG, raw data is for 15min
- `CurrentPriceCard.tsx` shows "vs previous 15min" / "next 15min" but API data is hourly
- Labels should read "vs previous hour" / "next hour"
- **Complexity:** Trivial (two string changes)

### 2.2 Quick-Access Timeframe Buttons (Replace Dropdown)
- Replace the `<select>` dropdown with pill/segmented buttons for Today, Tomorrow, Yesterday
- Keep a "More..." overflow for less-common timeframes
- The unused `ToggleGroup` component at `ui/toggle-group.tsx` was likely intended for this
- **Why:** Most frequent action requires two clicks (open dropdown + select); should be one click
- **Complexity:** Low

### 2.3 Tooltip Enhancement: Show Relative Context
- Show how the hovered price compares to the day's median (e.g., "12% below median" badge)
- `stats` object already available in `PriceChart` props — just needs display in `CustomTooltip`
- **Why:** Users want instant "good price or bad price?" without cross-referencing reference lines
- **Complexity:** Low

### 2.4 Empty State Banner for "Tomorrow" Before Price Publication
- When "Tomorrow" is selected but all data points are `isPredicted: true`, show a banner: "Official prices typically published around 14:00 CET. Showing predictions."
- **Why:** Users may not realize the dashed indigo line means unofficial predictions
- **Complexity:** Low

### 2.5 Cheapest Period: Show Result in Controls Panel
- Display discovered time range and avg price (e.g., "02:00–05:00, avg 3.21 ¢/kWh") in the Controls panel, not just as a chart overlay label
- Requires lifting cheapest period calculation from `PriceChart.tsx` to `Dashboard.tsx`
- **Why:** Chart label is small and hard to read on mobile; controls panel is always scannable
- **Complexity:** Low–Medium

### 2.6 Keyboard Navigation & Accessibility (a11y)
- Add `aria-pressed` to toggle buttons, `aria-label` to chart, proper focus management
- Hidden data table fallback for screen readers
- **Why:** Zero a11y implementation currently; fails WCAG 2.1 Level A
- **Complexity:** Medium

---

## 3. Design / Visual Enhancements

### 3.1 Animated Number Transitions on Current Price
- Use `framer-motion` (already installed, unused) to animate price value changes with count-up/down effect
- Wrap price display in `CurrentPriceCard.tsx` with `motion.div` + `AnimatePresence`
- **Why:** Most prominent number on the page currently snaps instantly; animation adds premium feel
- **Complexity:** Low

### 3.2 Min/Max Price Annotations on Chart
- Mark highest and lowest price points with small inline labels directly on the data line
- **Why:** Users constantly scan for peak/trough — removes need to hover the entire chart
- **Complexity:** Medium

### 3.3 Skeleton Loading State
- Replace the centered spinner with a full skeleton UI matching the final layout (card + controls + chart placeholders)
- **Why:** Eliminates Cumulative Layout Shift (CLS) and feels faster
- **Complexity:** Low

### 3.4 Staggered Entry Animations
- Use `framer-motion` for orchestrated fade-in + slide-up on dashboard sections (100–200ms offsets)
- **Why:** `framer-motion` is installed but unused; staggered reveals add the "cinematic" feel PRD emphasizes
- **Complexity:** Low

### 3.5 Color-Coded Price Zone Bands on Chart Background
- Subtle horizontal `<ReferenceArea>` bands: green (below median), yellow (median–P75), red (above P75)
- **Why:** Provides always-on visual price context without enabling statistical overlays
- **Complexity:** Low–Medium

---

## 4. Performance & Technical

### 4.1 Replace CORS Proxy with Next.js API Route
- Current third-party proxy (`codetabs.com`) has no SLA, adds latency, and is a security concern
- Requires removing `output: "export"` or using a Cloudflare Worker
- **Why:** Eliminates dependency on untrusted third-party for all API traffic
- **Complexity:** Medium–High (deployment model change)

### 4.2 Memoize Expensive Chart Computations
- Wrap `chartData` mapping, gradient offset, and cheapest period sliding window in `useMemo`
- Currently recompute on every render, including hover state changes
- **Why:** Concrete perf issue — O(n×k) cheapest window runs on every hover
- **Complexity:** Low

### 4.3 Client-Side Data Cache
- In-memory `Map` cache keyed by date range with TTL; serve from cache when switching back to a previously viewed timeframe
- Auto-refresh bypasses cache for current timeframe
- **Why:** Switching Today → Tomorrow → Today currently triggers redundant API calls through the CORS proxy
- **Complexity:** Low–Medium

### 4.4 Retry Logic with Exponential Backoff
- Auto-retry failed API calls (1s, 2s, 4s) up to 3 attempts before showing error state
- **Why:** CORS proxy is flaky; transient failures are likely and invisible retries improve UX
- **Complexity:** Low

### 4.5 Timezone Display Clarity
- Show detected timezone (e.g., "Times shown in EET") near chart X-axis or footer
- Use `Intl.DateTimeFormat().resolvedOptions().timeZone`
- **Why:** Current implicit UTC→local conversion can confuse travelers or VPN users
- **Complexity:** Low

---

## Priority Ranking (Impact vs. Effort)

| # | Proposal | Impact | Effort |
|---|----------|--------|--------|
| 1 | **1.4** Persistent User Preferences | High | Low |
| 2 | **2.1** Fix "15min" Label Bug | High | Trivial |
| 3 | **4.2** Memoize Chart Computations | High | Low |
| 4 | **2.2** Quick-Access Timeframe Buttons | High | Low |
| 5 | **3.1** Animated Number Transitions | Medium | Low |
| 6 | **2.3** Tooltip with Relative Context | Medium | Low |
| 7 | **3.4** Entry Animations (Framer Motion) | Medium | Low |
| 8 | **1.1** Price Alert Thresholds | High | Medium |
| 9 | **1.2** Cost Calculator | High | Medium |
| 10 | **2.4** Tomorrow Empty State Banner | Medium | Low |
| 11 | **3.3** Skeleton Loading | Medium | Low |
| 12 | **2.5** Cheapest Period in Controls | Medium | Low–Med |
| 13 | **4.3** Data Fetch Caching | Medium | Low–Med |
| 14 | **4.4** Retry Logic | Medium | Low |
| 15 | **3.5** Color-Coded Price Zones | Medium | Low–Med |
| 16 | **3.2** Min/Max Chart Annotations | Medium | Medium |
| 17 | **4.5** Timezone Clarity | Low–Med | Low |
| 18 | **2.6** Accessibility (a11y) | High | Medium |
| 19 | **1.3** Multi-Region Comparison | High | Medium |
| 20 | **1.5** Price Heatmap View | High | High |
| 21 | **1.6** Share/Export | Medium | Medium |
| 22 | **4.1** Replace CORS Proxy | High | Med–High |
