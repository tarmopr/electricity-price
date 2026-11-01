# Electricity Price in Estonia

Live Nord Pool spot market electricity price dashboard for Estonia. Monitor current rates, analyze trends, and plan your energy consumption.

Built with Next.js (App Router), deployed on Cloudflare Workers with D1 database for historical price storage.

## Features

All prices are shown in ¢/kWh (Elering publishes €/MWh) and in Estonian time (Europe/Tallinn), with or without 22% VAT.

- **Current price card** — the current 15-minute price, the change vs. the previous and next slot, and the median of the selected period.
- **Price chart** — area chart of the selected period with official prices and predictions (dashed, indigo) shown apart, min/max annotations and optional overlays: mean, median, 75th/90th/95th percentile, 7-day and 30-day hourly averages. The cheapest window from the cost calculator is always highlighted.
- **Periods** — quick pills for Yesterday, Today, Tomorrow and Next 24h (always visible, also on phones), plus This Week, Last 7 Days, Next 7 Days, Last 30 Days and a custom date range under "More". Multi-day periods are aggregated to keep the chart fast: hourly for week periods, 6-hour buckets for Last 30 Days, and 1/6/12/24-hour buckets for custom ranges depending on length.
- **Best time card** — shown at the top of the page: when to run the selected appliance (e.g. "Tonight 23:00 – Tomorrow 07:00"), the cost, and the saving vs. starting now. Tap it to open the cost calculator.
- **Cost calculator** — presets (EV Charge 40 kWh / 8 h ready by 07:00, Washing Machine, Dryer, Dishwasher, Sauna) or custom consumption, duration and "Ready by" time.
  - Searches its own rolling horizon, **from now to the end of tomorrow**, independent of the chart period, so overnight windows across midnight are found.
  - 15-minute resolution: duration in 0.25 h steps (e.g. 2.5 h), "Ready by" in 15-minute steps, or no deadline.
  - "Ready by" means the next occurrence of that time; it rolls over to the following day only when less than half the duration remains. If no window fits before the deadline, the best full-length window is shown with a "finishes after …" warning.
  - Estimates: Starting now, Best window, Next-hours average and Peak; a "Predicted" badge when the window uses predicted prices.
  - Number fields accept decimals with a comma or a dot (12,5), can be cleared while typing, select their content on tap and have − / + steppers.
- **Heatmap** — Calendar (day × hour) and Weekly Pattern (weekday × hour) views; on phones the grid is transposed (hours as rows) and a tap shows the cell's price.
- **Price alerts** — notify when the current price goes below or above a threshold (negative thresholds allowed); in-page banner plus an optional browser notification.
- **Predictions** — before Elering publishes tomorrow's prices (around 14:00 CET), missing hours are predicted from the same hour yesterday and 7 days ago, with a banner on the Tomorrow view.
- **Share** — copies a link with the period, VAT setting, view mode and custom range (native share sheet on phones).
- **Persistence and refresh** — settings are kept in `localStorage`; prices refresh every 15 minutes, when a sleeping phone tab becomes visible again, and when the network comes back.
- **Mobile** — 44 px touch targets, 16 px inputs (no iOS zoom), hover effects only on hover-capable devices, compact header.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, Turbopack)
- **Runtime:** Cloudflare Workers via [@opennextjs/cloudflare](https://github.com/opennextjs/opennextjs-cloudflare)
- **Database:** Cloudflare D1 (SQLite at edge)
- **Styling:** Tailwind CSS
- **Charting:** Recharts
- **Data Source:** [Elering API](https://dashboard.elering.ee/v3/api-docs) (Estonian electricity grid operator)

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm

### Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The dev server uses `initOpenNextCloudflareForDev()` which simulates Cloudflare bindings (including D1) locally via [miniflare](https://miniflare.dev). A local `.wrangler/` directory is created automatically for the local D1 database.

### Local Database Setup

The local D1 database is created automatically when you first run `npm run dev`. To apply the schema to the local database:

```bash
npx wrangler d1 execute electricity-prices --local --file=db/schema.sql
```

### Testing with the Database Locally

Once the local schema is applied, you can sync price data to your local database:

```bash
# Sync last 2 days (automatic mode — starts from latest timestamp in DB or last 2 days)
curl -X POST http://localhost:3000/api/sync

# Sync a specific date range (manual mode)
curl -X POST "http://localhost:3000/api/sync?start=2025-06-01T00:00:00.000Z&end=2025-07-01T00:00:00.000Z"

# Check sync status (latest/earliest timestamp, total data points)
curl http://localhost:3000/api/sync
```

After syncing, the D1-backed API routes return data from the local database:

```bash
# Daily averages
curl "http://localhost:3000/api/prices/daily?start=2026-03-01&end=2026-03-03"

# Monthly averages
curl "http://localhost:3000/api/prices/monthly?start=2025-03&end=2026-03"

# Weekday-hour pattern (for heatmap)
curl "http://localhost:3000/api/prices/weekday-pattern?year=2026&month=2"
```

## Cloudflare First-Time Setup

### 1. Install Wrangler and Login

```bash
npx wrangler login
```

### 2. Create the D1 Database

```bash
npx wrangler d1 create electricity-prices
```

Copy the `database_id` from the output and update `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "electricity-prices",
    "database_id": "<your-database-id>"
  }
]
```

### 3. Apply the Database Schema

```bash
npx wrangler d1 execute electricity-prices --remote --file=db/schema.sql
```

### 4. Deploy

```bash
npm run deploy
```

This runs the OpenNext build, patches the worker with the scheduled sync handler, and deploys to Cloudflare Workers.

### 5. Sync Historical Data (Prefill Database)

After the first deploy, the database is empty. Backfill price history by calling the sync endpoint with a start and end date, at most 31 days per call (sized for the Workers Free limits: 10 ms CPU and 50 D1 queries per invocation, 100k rows written per day):

```bash
# Backfill one month
curl -X POST -H "Authorization: Bearer $SYNC_SECRET" \
  "https://your-domain.com/api/sync?start=2025-01-01T00:00:00.000Z&end=2025-02-01T00:00:00.000Z"

# Verify the sync status
curl "https://your-domain.com/api/sync"
```

The sync also recomputes all aggregate tables (hourly, daily, weekly, monthly, weekday-hour averages).

#### Recompute aggregates without refetching

After a change to how aggregates are bucketed, rewrite the calendar tables from the hourly averages already stored, one Tallinn month per call. It does not call Elering or rewrite prices, so each call stays inside the Workers Free limits:

```bash
for m in 2025-01 2025-02 2025-03; do
  curl -X POST -H "Authorization: Bearer $SYNC_SECRET" "https://your-domain.com/api/sync/recompute?month=$m"
done
```

### 6. CI and Deployments

GitHub Actions (`.github/workflows/deploy.yml`, job "Build & Validate") runs on every pull request and push to `main`: `npm ci`, lint, tests, the Next.js build, the OpenNext build and the scheduled-handler patch. Despite the file name it **does not deploy** and needs no secrets.

Deploy with `npm run deploy`, or connect the repository to [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) (this repository's PRs show a "Workers Builds" check).

## Scheduled Sync

Prices are synced automatically via Cloudflare Cron Triggers every 4 hours (02:00, 06:00, 10:00, 14:00, 18:00, 22:00 UTC). Elering publishes next-day prices daily after 13:00 EET.

The sync is resilient to missed runs — it checks the latest timestamp in the database and fetches only missing data from that point forward. If a run stored prices but failed to write the aggregates, the next run recomputes them (it compares the latest daily aggregate with the latest price).

## Testing

The project uses [Vitest](https://vitest.dev/) with jsdom environment for testing.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

### Test Structure

Tests are located in `src/__tests__/` mirroring the source structure:

```
src/__tests__/
├── setup.ts        # Test setup (jest-dom matchers)
├── api/            # API routes: price proxy and sync (parameter validation, behaviour)
├── components/     # React components (Dashboard, PriceChart, PriceHeatmap, CostCalculator,
│                   #   BestWindowCard, Controls, ShareButton, ui/NumericField, …)
└── lib/            # Utilities and hooks: cheapest window search, Tallinn timezone helpers,
                    #   numeric input parsing, predictions, statistics, share state, D1 and
                    #   Elering helpers, useCostCalculator, useDashboardPrices, usePersistedState, …
```

### Test Setup

- **Framework:** Vitest 4.x with `@vitejs/plugin-react`
- **Environment:** jsdom (simulates browser APIs like `localStorage`)
- **Matchers:** `@testing-library/jest-dom` for DOM assertions
- **React hooks:** `@testing-library/react` with `renderHook` for hook testing
- **Mocking:** Vitest's built-in `vi.mock()` and `vi.stubGlobal()` for mocking `fetch`, D1 database, and `@opennextjs/cloudflare`

External dependencies (Cloudflare context, Elering API, D1 database) are mocked in tests. Pure utility functions are tested directly.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local dev server with Turbopack (port 3000) |
| `npm run build` | Build Next.js for production |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run preview` | Build and preview as Cloudflare Worker locally |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run cf-typegen` | Regenerate Cloudflare Worker types after binding changes |
| `npm run lint` | Run ESLint |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/prices` | GET | Proxy to Elering API (query params: `start`, `end`) |
| `/api/prices/current` | GET | Current price (D1 with Elering fallback) |
| `/api/prices/hourly` | GET | Hourly averages from D1 |
| `/api/prices/daily` | GET | Daily averages from D1 |
| `/api/prices/weekly` | GET | Weekly averages from D1 |
| `/api/prices/monthly` | GET | Monthly averages from D1 |
| `/api/prices/weekday-pattern` | GET | Weekday-hour averages from D1 (for heatmap) |
| `/api/sync` | GET | Sync status (latest/earliest timestamp, total count) |
| `/api/sync` | POST | Trigger price sync (auto or manual with `start`/`end` params) |
| `/api/sync/recompute` | POST | Rewrite one month's daily/weekly/monthly/weekday-hour aggregates from stored hourly averages (`month=YYYY-MM`) |

## Database Schema

Stored in `db/schema.sql`. Six tables:

- **`prices`** — Raw 15-minute prices (source of truth from Elering)
- **`hourly_averages`** — Hourly aggregates (computed from raw prices)
- **`daily_averages`** — Daily aggregates (computed from hourly averages)
- **`weekly_averages`** — Weekly aggregates (computed from hourly averages)
- **`monthly_averages`** — Monthly aggregates (computed from hourly averages)
- **`weekday_hour_averages`** — Weekday x hour averages scoped by year+month (for heatmap patterns)

All aggregates above hourly level are computed from `hourly_averages` (not raw prices) to ensure equal hour weighting regardless of whether the source data uses 15-minute or 1-hour granularity.
