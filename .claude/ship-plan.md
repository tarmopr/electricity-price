# Ship config

## Repo
- Host: github
- Tracker: none
- Base branch: main
- Merge: squash

## Prerequisites
| Command | Background | Ready when |
|---|---|---|
| npm ci | no | exit 0 |
| npm run dev | yes | http://localhost:3000 answers |

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Lint | npm run lint | | |
| Test | npm test | | |
| Build | npm run build | | |
| OpenNext build | npx opennextjs-cloudflare build | | 30 |
| Scheduled handler patch | node scripts/add-scheduled-handler.js | | |

## Fix rules
- Never use dynamic Tailwind class construction (e.g. `bg-${color}-500`); only complete static class strings.
- Preserve comments that describe intent or business logic.

## UI testing
- URL: http://localhost:3000
- Started by: Prerequisites row `npm run dev`
- Sign-in: none (public app, no accounts)
- User-visible paths: src/**, tailwind.config.ts
- Roles: anonymous visitor
- Notes: Prices are EUR/MWh from Elering shown as ¢/kWh; check the VAT (22%) toggle. Times are Europe/Tallinn. Check mobile (390px) and desktop (1440px) widths. Stop the `npm run dev` prerequisite before the Build / OpenNext gates (both write `.next/`). If Claude in Chrome tools are unavailable, drive scenarios with Playwright + installed Chrome (see `.claude/ship-plan/blockers.md`, UI).

## CI
- Workflow: deploy.yml
