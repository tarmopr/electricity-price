# Agent tooling

Which Claude Code skills and agents to use in this repo, and when. Project rules for all agents are in `AGENTS.md`; `CLAUDE.md` imports it.

## At a glance

| You want to… | Use | Scope |
|---|---|---|
| Take an idea or issue to a merged PR, incl. design and plan | `/ai-skills:ship-issue` | global plugin |
| Implement an existing written plan through to a merged PR | `/ai-skills:ship-plan <plan file>` | global plugin |
| Bring a branch or PR to merge-ready: gates, UI checks, review rounds, PR comments, CI | `/ai-skills:verify-and-fix` | global plugin |
| Review a diff for this app's domain rules | `domain-reviewer` agent | project (`.claude/agents/`) |
| Audit the whole codebase, not a diff | `/review-codebase` | project (`.claude/skills/`) |

The global skills come from the `ai-skills` plugin; the review rounds also use the `pr-review-toolkit` plugin. Install both to use the ship workflow.

## Ship workflow (global skills)

All three read `.claude/ship-plan.md`, the single list of gates and UI-testing setup:

- **Gates:** `npm run lint`, `npm test`, `npm run build`, `npx opennextjs-cloudflare build`, `node scripts/add-scheduled-handler.js` — the same steps as `.github/workflows/deploy.yml`.
- **UI testing:** `npm run dev` on http://localhost:3000, mobile (390px) and desktop (1440px). Stop the dev server before the build gates (both write `.next/`).
- **Reviewers by path:** `domain-reviewer` joins every review round when the diff touches `src/**`, `db/**` or `scripts/**`.
- **Fix rules:** no dynamic Tailwind classes; preserve intent comments.

`.claude/ship-plan/blockers.md` records what blocked earlier runs and the fix (e.g. zsh needs `eval "$cmd"` for commands stored in a variable; Playwright fallback when Claude in Chrome is unavailable). The skills read it first and append new entries.

Opening a PR, merging and deploying stay with you: the skills hand over the exact command.

Change gates or reviewers by editing `.claude/ship-plan.md`, not the skills.

## `domain-reviewer` agent

`.claude/agents/domain-reviewer.md` — read-only reviewer for what generic reviewers miss: €/MWh → ¢/kWh (÷10), VAT applied once, Tallinn timezone via `@/lib/timezone` (flags browser-local date-fns use), `hourly_averages` aggregation, `isPredicted` handling, D1 parameterization, Workers limits, mobile touch/input sizes, static Tailwind classes.

- **Automatically:** in every verify-and-fix / ship-plan review round (via `## Reviewers by path`).
- **By hand:** after a small change made outside the ship skills — ask Claude to "run domain-reviewer on the diff". It returns issues graded Critical / Major / Minor with `file:line` and a verdict.

## `review-codebase` skill

`.claude/skills/review-codebase/SKILL.md` — full-repo health check across architecture, domain correctness, code quality, security, performance, testing and styling/UX. Use it periodically or before a larger refactor, not per PR. Trigger with `/review-codebase` or "audit the codebase". Output: findings grouped by severity with file, line and suggested fix, plus an overall health rating. It reports only; fixing is a separate task.

## Removed (Nov 2026)

`implement`, `safe-ship` and `pr` skills and the `code`, `test` and `utility` agents were removed: the global ship skills replace them, the agents never loaded as subagents (no `name`/`description` frontmatter), and they pinned outdated models. Test patterns from the `test` agent now live in `AGENTS.md` → Testing. Recover any of them from git history if needed.
