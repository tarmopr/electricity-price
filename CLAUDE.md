# Claude Code Instructions

## Agent Instructions

See [AGENTS.md](./AGENTS.md) for full project conventions, tech stack, coding standards, and git rules.

## Build Validation

**Always run `npm run build` after making code changes** to validate the project compiles and builds successfully. Do not consider a task complete until the build passes.

## Testing

- Tests must be created for all new code (API routes, utility functions, components).
- After a successful build, run `npm test` to validate that existing functionality still works as expected.
- Do not consider a task complete until both build and tests pass.

## Deployment

- The app deploys to Cloudflare Workers via `npm run deploy` (runs OpenNext build + wrangler deploy).
- After changes to Cloudflare bindings (D1, KV), regenerate types: `npm run cf-typegen`.
- Local Cloudflare preview: `npm run preview`.
