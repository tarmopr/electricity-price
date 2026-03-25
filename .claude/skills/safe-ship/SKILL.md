---
name: safe-ship
description: Use when implementing a feature or fix that must be committed and shipped as a PR with full validation. Triggers on "implement and ship", "safe ship", or any request where code changes need to reach a PR without breaking tests, types, lint, or imports.
---

# Safe Ship

## Overview

Implement fully, validate exhaustively, then commit and ship — never before all checks pass. Quality gates are non-negotiable; CI confirmation is required before any merge.

## Workflow

### Phase 1 — Implement

Use Serena symbol tools to understand the codebase before writing code. Implement the requested feature across all necessary files. Follow project conventions (CLAUDE.md).

### Phase 2 — Validate (loop, max 3 iterations per gate)

Run each gate in order. Fix failures and re-run. After 3 failed attempts on any gate: **STOP — report the blocker with file paths, error text, and what you tried.**

```
Gate 1:  npm test           → fix failures → re-run (max 3 iterations)
Gate 2:  npx tsc --noEmit   → fix type errors
Gate 3:  npm run lint        → fix violations
Gate 4:  Serena integrity check (see below)
```

**Serena integrity check:**
- `mcp__serena__find_symbol` — verify all new/modified exports exist and are named correctly
- `mcp__serena__search_for_pattern` — scan for any import paths referencing symbols you renamed, moved, or deleted; confirm no dangling references

### Phase 3 — Commit, Push, Open PR

Only enter Phase 3 when **all four gates are green**.

1. Commit with a conventional commit message (`type(scope): description`, imperative mood)
2. Push the branch
3. Open a PR with a descriptive title and body summarizing what changed and why

### Phase 4 — CI Gate (non-negotiable)

Wait for CI to complete. **Never approve or merge your own PR without confirming all CI checks are green.** If any check fails, diagnose and fix before proceeding.

## Iteration Budget

| Gate | Max attempts | On budget exhausted |
|------|-------------|---------------------|
| Tests | 3 | STOP — report blocker |
| Types | 3 | STOP — report blocker |
| Lint | 3 | STOP — report blocker |
| Serena check | 1 | STOP — report broken references |

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Committing before all gates green | Broken CI, wasted PR cycle |
| Skipping Serena check | Dangling imports silently break runtime |
| Merging without CI confirmation | Ships broken code (happened before — don't repeat) |
| Running gates out of order | Type errors cause test failures; fix types first reveals real test issues |

## Red Flags — Stop and Check

- "Tests are passing locally so I'll skip tsc" → Run tsc anyway. Always.
- "CI is probably fine" → Probably is not confirmed. Wait for green.
- "This is a small change" → Small changes break imports too. Run Serena check.
- Tempted to merge without CI → Never. Not once. Not for hotfixes.
