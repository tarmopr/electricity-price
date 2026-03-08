---
name: implement
description: >
  Full development lifecycle: code, test, lint, build, validate, commit, and review in an automated loop.
  Use this skill whenever the user asks to implement a feature, fix a bug, add functionality, or make code changes
  that should be validated and committed. Also trigger when the user says "implement", "build this",
  "add feature", "fix this bug", or any request that implies writing code and shipping it.
  Do NOT trigger for questions, explanations, or research that doesn't involve writing code.
---

# Implement Skill

You are executing a structured development workflow. Follow each phase in order. Do not skip phases or mark work as done until validation passes.

## Phase 1: Code

Write or modify the code for the requested feature or fix.

Before writing any code, understand the existing codebase:
- Read relevant source files to understand current patterns
- Check related components, utilities, and types

Follow project conventions while coding:
- Server Components by default. Only add `'use client'` for interactive elements (charts, toggles, forms)
- Tailwind CSS with the existing glassmorphism aesthetic. No default/basic styling
- `@/` path aliases for all imports
- Price units: Elering API returns EUR/MWh, display as cents/kWh. Respect VAT (22%) toggle
- Timezones: UTC to Europe/Tallinn using `date-fns` or `Intl`
- DB aggregation above hourly level: compute from `hourly_averages`, not raw prices

Keep changes minimal — only change what's needed for the task.

## Phase 2: Tests

Write or update tests for all new/changed code using Vitest.

- Tests go in `src/__tests__/` mirroring the source structure
- Follow patterns in `.claude/agents/test.md` (mock patterns, helper factories, etc.)
- Cover: happy path, error cases, edge cases (empty input, null, negative prices, timezone boundaries)
- Any test importing from `@/lib/db` must mock `@opennextjs/cloudflare`

## Phase 3: Validate

Run all three checks in sequence. If any fails, fix the issue and re-run that check. Do not proceed to the next check until the current one passes.

### 3a: Lint
```bash
npm run lint
```
If errors → fix them → re-run. Repeat until clean.

### 3b: Build
```bash
npm run build
```
If errors → fix them → re-run lint (in case the fix introduced lint issues) → re-run build. Repeat until clean.

### 3c: Test
```bash
npm test
```
If failures → fix them → re-run lint → re-run build → re-run tests. Repeat until all pass.

If you've been looping on the same error for 3+ attempts, stop and report the issue to the user instead of continuing to guess.

## Phase 4: Commit

Stage and commit the changes using Conventional Commits format.

- Format: `type(scope): description` in imperative mood
- Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `style`, `perf`
- Stage specific files (avoid `git add .` or `git add -A`)
- Write a concise message that explains the **why**, not just the **what**

## Phase 5: Review

Run a code review on the changed files using the review agent (`.claude/agents/review.md`).

Review the diff of the commit you just made. Check for:
- Bugs and correctness issues
- Security vulnerabilities
- Performance problems
- Missed edge cases
- Missing or inadequate tests
- Convention violations

## Phase 6: Fix Loop

Based on review findings, iterate up to **3 times**:

### Iteration 1
Fix **all** issues found (critical, major, and minor). Then re-run Phase 3 (validate) and Phase 4 (commit) and Phase 5 (review).

### Iteration 2
Only triggers if iteration 1 changed logic (not just formatting/naming). Fix **critical and major** issues only. Then re-validate, commit, and re-review.

### Iteration 3
**Hard stop.** Do not attempt further fixes. Report any remaining issues to the user with:
- File path and line number
- Issue severity (critical/major/minor)
- Description of the problem

Let the user decide how to proceed.

**Skip re-review** for trivial fixes (formatting, import order, variable naming) — just validate and commit.

## Completion

When all phases are done and review passes (or iteration limit is reached), report:

1. **What was done** — summary of changes made
2. **Files changed** — list of modified/created files
3. **Test coverage** — what the new tests cover
4. **Remaining issues** — any unresolved items from review (if applicable)
