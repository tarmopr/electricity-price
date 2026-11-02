# Known blockers

Read in full before the first round. Each entry: the symptom with the exact
error, the cause, the fix as an exact command, and the date. Correct a wrong
entry rather than adding a second.

## Gates and local environment

### Gate loop exits 127 for every gate
- **Symptom:** `(eval):1: command not found: npm run lint` (exit 127) for each gate when commands are stored in a variable and run as `$c`.
- **Cause:** the Bash tool runs zsh, which does not word-split unquoted parameters.
- **Fix:** run each stored command with `eval "$c"` (e.g. `eval "$c" > <gate>.log 2>&1`).
- **Date:** 2026-11-01

### `next build` and `next dev` share `.next`
- **Symptom:** risk of a corrupted build or dev server when `npm run build` / OpenNext build runs while `npm run dev` is up.
- **Cause:** both write `.next/`.
- **Fix:** stop the dev server (TaskStop) before the Build / OpenNext gates; restart `npm run dev` afterwards for UI scenarios.
- **Date:** 2026-11-01

### `gh pr create` refused by the permission system (not reproduced)
- **Symptom:** `Permission to use Bash with command gh pr create ... has been denied.` (twice, also with `--body-file`).
- **Cause:** that session's permission mode refused it; it is not a standing restriction. On 2026-11-02 `gh pr create --base main --head <branch> --title "..." --body-file <file>` succeeded (#33).
- **Fix:** run `gh pr create` yourself first. Only if it is refused, hand the user the exact command (`! gh pr create --base main --title "..." --body-file <file>`) and continue after they run it.
- **Date:** 2026-11-01, corrected 2026-11-02

### Hook asks for `/verify`, which is not installed
- **Symptom:** PreToolUse hook: "Reminder (verify-reminder hook): run /verify on this branch before committing code or opening a PR".
- **Cause:** no `/verify` skill exists in this setup; `verify-and-fix` is the closest equivalent.
- **Fix:** run `/ai-skills:verify-and-fix`; report that `/verify` itself is unavailable.
- **Date:** 2026-11-01

### `npm run build` fails once on the Google font module
- **Symptom:** `Turbopack build failed with 1 errors: [next]/internal/font/google/inter_….module.css Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` (import trace `./src/app/layout.tsx`).
- **Cause:** transient — `next/font/google` downloads Inter at build time; the OpenNext build that ran `next build` right after passed, and a rerun passed.
- **Fix:** rerun the Build gate once (`CI=true npm run build`); treat a second identical failure as real (network/proxy).
- **Date:** 2026-11-01

## CI

### Copilot missing from `reviewRequests` right after `gh pr edit --add-reviewer @copilot`
- **Symptom:** the command succeeds, but `gh pr view <n> --json reviewRequests` and `pulls/<n>/requested_reviewers` both list nobody.
- **Cause:** the bot request is not listed there; it was recorded and the review arrived about 5 minutes later.
- **Fix:** confirm with `gh api repos/<owner>/<repo>/issues/<n>/timeline --jq '.[]|select(.event=="review_requested")|.requested_reviewer.login'` (shows `Copilot`); do not request it again.
- **Date:** 2026-11-02

## UI

### Claude in Chrome tools unavailable
- **Symptom:** `ToolSearch select:mcp__claude-in-chrome__...` → "No matching deferred tools found".
- **Cause:** the Chrome extension MCP is not connected in this session.
- **Fix:** drive scenarios with Playwright and the installed Chrome: `npm i playwright-core@1.48.2` in a scratch dir, `chromium.launch({ channel: 'chrome', headless: true })`, mobile context `{ viewport: {width:390,height:844}, isMobile: true, hasTouch: true, timezoneId: 'Europe/Tallinn' }`.
- **Date:** 2026-11-01

### Share button scenario reads "" in headless mobile Chrome
- **Symptom:** after tapping Share, `role="status"` stays empty and the clipboard is empty.
- **Cause:** headless Chrome exposes `navigator.share`, so ShareButton takes the native-share path (no sheet in headless) and never copies.
- **Fix:** in the scenario context, `await ctx.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }))` and grant `permissions: ['clipboard-read','clipboard-write']`.
- **Date:** 2026-11-01

### Price text of the best-window card is unparseable from innerText
- **Symptom:** regex on the card's `innerText` returns nonsense (e.g. `569.28`) for the average price.
- **Cause:** cost and average are adjacent inline spans; `innerText` joins them (`€19.299.65 ¢/kWh`).
- **Fix:** read the leaf `span` whose text ends with `¢/kWh` instead of regexing the whole card.
- **Date:** 2026-11-01
