# Claude Code Instructions

## Agent Instructions

See [AGENTS.md](./AGENTS.md) for full project conventions, tech stack, coding standards, and git rules.

## Build Validation

**Always run `npm run build` after making code changes** to validate the project compiles and builds successfully. Do not consider a task complete until the build passes.

## Testing

- Tests must be created for all new code (API routes, utility functions, components).
- After a successful build, run `npm test` to validate that existing functionality still works as expected.
- Do not consider a task complete until both build and tests pass.

## Code Review After Validation

After lint, build, and tests all pass, run a code review using the **review** agent before considering a task complete. Follow this iterative process:

### Iteration 1 (Full Review)
- Run the review agent on all changed files.
- Fix **all** issues: critical, major, and minor.
- Re-run `npm run build` and `npm test` to validate fixes.

### Iteration 2 (Blocking Only)
- Re-review **only if** iteration 1 fixes changed logic (not just formatting/naming).
- Fix only **critical and major** issues. Report minor issues as notes but do not fix them.
- Re-run `npm run build` and `npm test` to validate fixes.

### Iteration 3 (Hard Stop)
- If critical or blocking issues remain after iteration 2, **stop the loop**.
- Do not attempt further fixes. Instead, provide a clear report:
  - List each remaining issue with file path, line number, and severity.
  - Explain why the issue persists and what would be needed to resolve it.
  - Let the user decide how to proceed.

### Rules
- **Never exceed 3 review iterations.** This prevents infinite review-fix loops.
- **Always re-validate** (build + tests) after any code fix, even minor ones.
- **Skip re-review** if fixes were trivial (typos, formatting, import ordering). Only re-review when logic changed.
- Minor issues noted in iteration 2+ are informational only — do not fix them to avoid churn.

## Deployment

- The app deploys to Cloudflare Workers via `npm run deploy` (runs OpenNext build + wrangler deploy).
- After changes to Cloudflare bindings (D1, KV), regenerate types: `npm run cf-typegen`.
- Local Cloudflare preview: `npm run preview`.
