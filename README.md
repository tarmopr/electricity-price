# Electricity Price in Estonia

Live Nord Pool spot market electricity price dashboard for Estonia. Monitor current rates, analyze trends, and plan your energy consumption.

Built with Next.js (App Router), deployed on Cloudflare Workers with D1 database for historical price storage.

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

After the first deploy, the database is empty. Trigger a historical backfill by calling the sync endpoint with a start date. The Elering API allows a maximum of 1 year per request, and the sync route handles chunking automatically.

```bash
# Backfill the past year
curl -X POST "https://your-domain.com/api/sync?start=2025-03-01T00:00:00.000Z"

# Backfill a specific range
curl -X POST "https://your-domain.com/api/sync?start=2025-01-01T00:00:00.000Z&end=2025-06-01T00:00:00.000Z"

# Verify the sync status
curl "https://your-domain.com/api/sync"
```

The sync also recomputes all aggregate tables (hourly, daily, weekly, monthly, weekday-hour averages).

### 6. GitHub Actions CI/CD

For automated deployments on push to `main`, add these GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN` — [Create an API token](https://dash.cloudflare.com/profile/api-tokens) with "Workers Scripts: Edit" permission
- `CLOUDFLARE_ACCOUNT_ID` — Found in your Cloudflare dashboard sidebar

## Scheduled Sync

Prices are synced automatically via Cloudflare Cron Triggers every 4 hours (02:00, 06:00, 10:00, 14:00, 18:00, 22:00 UTC). Elering publishes next-day prices daily after 13:00 EET.

The sync is resilient to missed runs — it checks the latest timestamp in the database and fetches only missing data from that point forward.

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
├── setup.ts                    # Test setup (jest-dom matchers)
├── api/
│   └── prices.test.ts          # API route parameter validation and behavior
└── lib/
    ├── api.test.ts             # Client-side utilities (conversion, statistics, aggregation)
    ├── db.test.ts              # Database utilities (upsert batching, aggregate computation)
    ├── elering.test.ts         # Server-side Elering API helpers (fetch, response helpers)
    └── usePersistedState.test.ts  # localStorage persistence hook
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

## Database Schema

Stored in `db/schema.sql`. Six tables:

- **`prices`** — Raw 15-minute prices (source of truth from Elering)
- **`hourly_averages`** — Hourly aggregates (computed from raw prices)
- **`daily_averages`** — Daily aggregates (computed from hourly averages)
- **`weekly_averages`** — Weekly aggregates (computed from hourly averages)
- **`monthly_averages`** — Monthly aggregates (computed from hourly averages)
- **`weekday_hour_averages`** — Weekday x hour averages scoped by year+month (for heatmap patterns)

All aggregates above hourly level are computed from `hourly_averages` (not raw prices) to ensure equal hour weighting regardless of whether the source data uses 15-minute or 1-hour granularity.
