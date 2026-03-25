# Claude Code Instructions

## Pull Requests

Always run tests and verify CI passes before approving or merging any PR. Never approve a PR without confirming all checks are green.

## UI/Animation Guidelines

When implementing animations or visual transitions, memoize data inputs to prevent re-renders, initialize spring/transition values from current state (not defaults), and test with the actual chart re-render cycle before marking complete.

## Code Style

Avoid dynamic Tailwind CSS class construction (e.g., `bg-${color}-500`). Always use complete static class strings so they survive PurgeCSS in production.

## Validation (required after every code change)

1. `npm run lint` — must pass.
2. `npm run build` — must pass.
3. `npm test` — must pass. All new code needs tests.
4. Run **review** agent on changed files. Max 3 iterations:
   - **Iter 1:** Fix all issues (critical, major, minor) → re-validate.
   - **Iter 2:** Only if iter 1 changed logic. Fix critical/major only → re-validate.
   - **Iter 3:** Hard stop. Report remaining issues with file paths, line numbers, severity. Let user decide.
   - Skip re-review for trivial fixes (formatting, naming, imports).

## Git

- Conventional Commits: `type(scope): description` — imperative mood.
- Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `style`, `perf`

## Code Comments

- Preserve comments that describe **intent** or **business logic** (the *why*, not the *what*).
- Do not remove or rewrite these during refactors — they capture original reasoning that is hard to reconstruct.

## Key Rules

- Prices: Elering API returns EUR/MWh → display as cents/kWh. Respect VAT (22%) toggle.
- Timezones: UTC ↔ Europe/Tallinn. Use `date-fns` or `Intl`.
- Server Components by default. `'use client'` only for interactive elements.
- Premium UI: Tailwind + glassmorphism. No default/basic styling.
- `@/` path aliases for all imports.
- DB aggregation above hourly level: compute from `hourly_averages`, not raw prices.

## Deploy

- `npm run deploy` (OpenNext + wrangler). After binding changes: `npm run cf-typegen`.
