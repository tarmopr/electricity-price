---
name: implement
description: Use when the user asks to implement a feature, fix a bug, add functionality, or make code changes. Triggers on "implement", "build this", "add feature", "fix this bug", or any request implying writing and shipping code. Do NOT trigger for questions, explanations, or research without code changes.
---

# Implement

## Overview

Orchestrate implementation through specialized subagents. The orchestrator (you) manages phase sequencing and commit decisions. Coding and review are delegated to purpose-built agents that keep their contexts focused.

## Phase 1 — Implement (code agent subagent)

Dispatch the **code agent** as a subagent (`subagent_type: general-purpose`, prompt includes `.claude/agents/code.md` context).

Provide in the prompt:
- Full feature/fix description
- Any relevant file paths, patterns, or prior decisions
- Explicit instruction to run all three validation checks: `npm run lint`, `npm run build`, `npm test`

The code agent handles: understanding existing code via Serena, implementing the feature, writing/updating tests following `.claude/agents/test.md` patterns, and running all validation.

The code agent must return:
- List of changed files
- Summary of changes made
- Validation status (all three checks green or specific failures)

**Do not advance to Phase 2 if the code agent reports validation failures.** Re-dispatch with the failure details for the agent to fix.

## Phase 2 — Integrity Check (orchestrator)

Run a Serena integrity check directly in the orchestrator session:

- `mcp__serena__find_symbol` — confirm all new/modified exports exist and are named correctly
- `mcp__serena__search_for_pattern` — scan for import paths referencing any renamed, moved, or deleted symbols; confirm no dangling references

If broken references are found: re-dispatch the code agent with specific findings. Re-run integrity check after.

## Phase 3 — Review (review agent subagent)

Dispatch the **review agent** as a subagent (`subagent_type: general-purpose`, prompt includes `.claude/agents/review.md` context).

Provide in the prompt:
- Full git diff of all changes (`git diff HEAD` or diff since branch diverged from main)
- List of changed files from Phase 1

The review agent returns structured findings with severity ratings (critical/major/minor) and a verdict: **Approve**, **Request Changes**, or **Needs Discussion**.

## Phase 4 — Decision (orchestrator)

```
Verdict = Approve OR only Minor issues?
  → Proceed to Phase 5 (commit)

Verdict = Request Changes (Critical or Major issues present)?
  → Increment iteration counter
  → iteration ≤ 3: Re-dispatch code agent with all findings → back to Phase 1
  → iteration > 3: Hard stop — report remaining issues to user
```

**Never commit before reaching this decision point.**

## Phase 5 — Commit

Stage specific files only — never `git add .` or `git add -A`.

Commit format (Conventional Commits, imperative mood):
- `type(scope): description`
- Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `style`, `perf`
- Message explains the **why**, not just the **what**

## Fix Loop Summary

| Iteration | Fix scope | On next verdict |
|-----------|-----------|-----------------|
| 1 | All issues (critical + major + minor) | Re-review |
| 2 | Critical + major only | Re-review |
| 3 | Hard stop | Report to user |

**Skip re-review** for trivial fixes (formatting, import order, variable naming) — just validate and commit directly.

## Hard Stop Conditions

Stop and report to user immediately when:
- Code agent loops on the same validation failure for 3+ attempts
- Iteration 3 reached with remaining critical/major issues
- Integrity check finds unresolvable broken references

Report: file path, line number, severity, what was attempted.

## Completion Report

When all phases complete, report:
1. **Changes** — summary of what was implemented
2. **Files** — list of modified/created files
3. **Tests** — what the new tests cover
4. **Remaining issues** — any unresolved review findings (if iteration limit reached)
