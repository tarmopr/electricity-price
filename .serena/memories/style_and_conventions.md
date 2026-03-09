# Code Style & Conventions

## TypeScript
- Strict mode
- `@/` path aliases for all imports (maps to `src/`)
- Interfaces preferred over type aliases for object shapes

## React / Next.js
- Server Components by default
- `'use client'` directive only for interactive elements (charts, toggles, forms, hooks)
- React.memo for presentational components

## Styling
- Tailwind CSS with glassmorphism aesthetic (bg-zinc-900/50, backdrop-blur, etc.)
- No default/basic styling — premium UI required
- Shared pill/button styles in `@/lib/styles.ts`

## Git
- Conventional Commits: `type(scope): description` in imperative mood
- Types: feat, fix, chore, refactor, test, docs, ci, style, perf

## Validation (after every code change)
1. `npm run lint` — must pass
2. `npm run build` — must pass
3. `npm test` — must pass; all new code needs tests

## Testing
- Tests in `src/__tests__/` mirroring source structure
- Vitest + Testing Library
- Mock `@opennextjs/cloudflare` for any test importing from `@/lib/db`
- Cover: happy path, error cases, edge cases

## Domain Rules
- Prices: Elering API EUR/MWh → cents/kWh (÷10). Respect VAT (22%) toggle.
- Timezones: UTC in DB ↔ Europe/Tallinn in frontend (date-fns or Intl)
- DB aggregation above hourly: compute from `hourly_averages`, not raw prices
