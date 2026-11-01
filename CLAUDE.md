# Claude Code Instructions

Project context, conventions, commands and validation live in `AGENTS.md` (shared by all agents):

@AGENTS.md

## Claude Code only

### Review loop (after the `AGENTS.md` validation steps pass)

Run the **review** agent (`.claude/agents/review.md`) on changed files. Max 3 iterations:
- **Iter 1:** Fix all issues (critical, major, minor) → re-validate.
- **Iter 2:** Only if iter 1 changed logic. Fix critical/major only → re-validate.
- **Iter 3:** Hard stop. Report remaining issues with file paths, line numbers, severity. Let user decide.
- Skip re-review for trivial fixes (formatting, naming, imports).

### Repo tooling
- Subagents: `.claude/agents/` (`code`, `review`, `test`, `utility`). Skills: `.claude/skills/` (`implement`, `safe-ship`, `pr`, `review-codebase`).
- `.claude/ship-plan.md` is the gate/UI-testing config for the ship-plan and verify-and-fix skills; `.claude/ship-plan/blockers.md` lists past blockers and their fixes — read both before running those skills.
