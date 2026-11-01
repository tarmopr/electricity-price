# Electricity Price Dashboard

## Purpose
Real-time Estonian electricity price dashboard showing current prices, historical data, predictions, heatmaps, and cost calculations. Data sourced from Elering API.

## Tech Stack
- **Framework**: Next.js 16 (App Router) with TypeScript
- **Deployment**: Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)
- **Database**: Cloudflare D1 (SQLite)
- **Styling**: Tailwind CSS 3 with glassmorphism aesthetic
- **Charts**: Recharts 3
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **Date handling**: date-fns 4
- **Testing**: Vitest 4 + Testing Library

## Key Domain Concepts
- Prices from Elering API: EUR/MWh → displayed as cents/kWh (÷10)
- VAT rate: 22% (toggleable in UI)
- Timezone: UTC in DB, Europe/Tallinn in frontend
- Data granularity: 15-min raw, aggregated to hourly/daily/weekly/monthly
- DB aggregation above hourly level uses `hourly_averages` table, not raw prices

## Project Structure
```
src/
  app/              # Next.js App Router pages and API routes
    api/
      prices/       # Price data endpoints (proxy, current, daily, hourly, weekly, monthly, weekday-pattern)
      sync/         # Elering → D1 sync endpoint
  components/       # React components (Dashboard, PriceChart, PriceHeatmap, Controls, BestWindowCard, CostCalculator, etc.)
    ui/             # Shared inputs (NumericField with steppers)
  lib/              # Shared utilities, hooks, types
    api.ts          # Client-side API functions
    db.ts           # D1 database operations
    elering.ts      # Server-side Elering API utilities
    price.ts        # Price conversion utilities (eurMwhToCentsKwh, applyVat, CHUNK_SIZE_MS)
    types.ts        # Shared TypeScript interfaces
    styles.ts       # Shared Tailwind pill/button style constants
    priceAlerts.ts  # Price alert threshold logic
    heatmapData.ts  # Heatmap data transformations
    shareState.ts   # URL share/export utilities
    cheapestWindow.ts # Rolling-horizon cheapest window search (15-min slots, ready-by deadline)
    timezone.ts     # DST-safe Europe/Tallinn helpers (ready-by occurrence, end of tomorrow, labels)
    numericInput.ts # Draft-string numeric parsing (comma decimals, clamping, 15-min snapping)
    chartLabel.ts   # Chart window-label layout helpers
    costCalculator.ts # Presets (with readyBy), limits, cost estimates
    prediction.ts   # Predicted prices (same hour yesterday + 7 days ago)
    useCostCalculator.ts # Cost calculator state + own rolling-horizon fetch
    useDashboardPrices.ts # Dashboard price fetching per period (incl. next_24h)
    usePersistedState.ts # localStorage-backed state hook
  __tests__/        # Tests mirroring source structure
```
