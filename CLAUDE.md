# Claude Code Instructions

Project context, conventions, commands and validation live in `AGENTS.md` (shared by all agents):

@AGENTS.md

## Claude Code only

- **Which skill or agent to use:** see `docs/agent-tooling.md`. Shipping work goes through the global `ship-issue` / `ship-plan` / `verify-and-fix` skills; they read `.claude/ship-plan.md` (gates, UI testing, reviewers) and `.claude/ship-plan/blockers.md` (past blockers and fixes).
- **Small change outside those skills:** after the `AGENTS.md` validation steps pass, run the `domain-reviewer` agent on the diff once. Fix Critical/Major findings, re-validate; re-review only if a fix changed logic. Report anything left with file, line and severity.
- **Full-repo audit:** the `review-codebase` skill.
