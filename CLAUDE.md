# Claude Code Instructions

## Validation (required after every code change)

1. `npm run build` — must pass.
2. `npm test` — must pass. All new code needs tests.
3. Run **review** agent on changed files. Max 3 iterations:
   - **Iter 1:** Fix all issues (critical, major, minor) → re-validate.
   - **Iter 2:** Only if iter 1 changed logic. Fix critical/major only → re-validate.
   - **Iter 3:** Hard stop. Report remaining issues with file paths, line numbers, severity. Let user decide.
   - Skip re-review for trivial fixes (formatting, naming, imports).

## Git

- Conventional Commits: `type(scope): description` — imperative mood.
- Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `style`, `perf`

## Key Rules

- Prices: Elering API returns EUR/MWh → display as cents/kWh. Respect VAT (22%) toggle.
- Timezones: UTC ↔ Europe/Tallinn. Use `date-fns` or `Intl`.
- Server Components by default. `'use client'` only for interactive elements.
- Premium UI: Tailwind + glassmorphism. No default/basic styling.
- `@/` path aliases for all imports.
- DB aggregation above hourly level: compute from `hourly_averages`, not raw prices.

## Deploy

- `npm run deploy` (OpenNext + wrangler). After binding changes: `npm run cf-typegen`.
