---
name: review-codebase
description: >
  Review the current codebase for architecture, domain correctness, code quality, security,
  performance, testing gaps, and styling/UX issues. Use when the user wants a full codebase audit,
  quality check, or health assessment. Trigger on "review codebase", "audit code", "code review",
  "quality check", or "codebase health".
  Do NOT trigger for reviewing a single file or PR diff — this is a full-project review.
---

# Codebase Review Skill

You are performing a comprehensive review of the electricity price dashboard codebase.
Work through each category systematically. Use symbolic tools to explore efficiently — do NOT read every file in full.

## Review Categories

### 1. Architecture & Structure
- Server vs Client component boundaries — is `'use client'` used only where necessary?
- Are API routes thin controllers delegating to `lib/`?
- Is there logic duplication between components, hooks, or API routes?
- Are shared types in `types.ts` complete and consistently used?

### 2. Domain Correctness
- Price conversion: Elering returns EUR/MWh. Display must be cents/kWh (divide by 10). Verify every conversion site.
- VAT (22%): applied correctly and toggleable. No double-application or missed spots.
- Timezone handling: UTC in DB, `Europe/Tallinn` in UI. Check every Date operation for correctness.
- DB aggregation: above hourly level must use `hourly_averages` table, NOT raw prices.

### 3. Code Quality
- TypeScript strictness: any usage of `any`, missing return types, loose generics.
- Error handling: are API routes and data fetching resilient? Are errors surfaced to the user?
- Unused exports, dead code, or stale imports.
- Functions that are too long or do too many things.
- Naming consistency (camelCase, conventions across files).

### 4. Security
- SQL injection in D1 queries (parameterized queries used?).
- Input validation on API routes (query params, body).
- XSS vectors in rendered content.
- Sensitive data exposure in client bundles.

### 5. Performance
- Unnecessary re-renders (missing memo, unstable references in deps arrays).
- Large client bundles — are heavy libs (recharts, framer-motion, date-fns) tree-shaken or lazy-loaded?
- API response sizes — is pagination or limiting in place?
- Database query efficiency (missing indexes, N+1 patterns).

### 6. Testing
- Coverage gaps: which `lib/` or component files lack corresponding tests?
- Are edge cases covered (empty data, API errors, timezone boundaries, DST transitions)?
- Are mocks realistic (especially D1 and Elering API)?

### 7. Styling & UX
- Consistent glassmorphism aesthetic (`bg-zinc-900/50`, `backdrop-blur`, etc.).
- Responsive design — does it work on mobile?
- Accessibility: aria labels, keyboard navigation, color contrast.
- Shared styles from `lib/styles.ts` used consistently (no one-off duplicates).

## Workflow

1. Use `get_symbols_overview` and `find_symbol` to explore files efficiently.
2. Use `search_for_pattern` for cross-cutting concerns (e.g. all `any` usages, raw SQL, timezone operations).
3. Only read full file bodies when needed to verify a specific issue.
4. Track findings as you go using the todo list.

## Output Format

For each finding, report:
- **File**: relative path and line number(s)
- **Severity**: Critical / Major / Minor
- **Category**: one of the 7 categories above
- **Issue**: concise description
- **Suggestion**: concrete fix or improvement

Group findings by severity (Critical first), then by category.

End with a summary:
- Total findings per severity
- Top 3 areas needing attention
- Overall codebase health assessment (Good / Needs Work / Concerning)
