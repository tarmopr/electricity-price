# AI Agent Guidelines (AGENTS.md)

Welcome to the `electricity-price` project. This file contains instructions and context for AI coding agents (like Copilot, Cursor, Gemini, etc.) to understand the project structure, conventions, and architectural decisions.

## Project Overview
- **Name:** electricity-price
- **Purpose:** Analyzing, fetching, or predicting electricity prices (TBD based on implementation).
- **Target Audience/Users:** Developers & Analysts.

## Tech Stack & Tools
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Focus on premium, sleek UI, glassmorphism)
- **Data Fetching:** Native fetch API (calling official public Elering Dashboard API)
- **Charting:** Recharts
- **Icons & Animation:** Lucide-react, Framer-motion
- **Package Manager:** npm

## Directory Structure
- `/src/app`: Next.js App Router pages and global layouts.
- `/src/components`: UI components (e.g., Dashboard, PriceChart, Controls, CurrentPriceCard).
- `/src/lib`: Utility functions (e.g., `api.ts` for Elering API integration and data processing/statistical math).

## Coding Conventions
1. **Design First:** The priority is a superb, premium UI/UX. Do not use default/basic styling.
2. **Components:** Use Server Components by default in App Router, and `'use client'` explicitly for interactive elements (charts, toggles).
3. **Data Processing:** Handle timezone conversions (UTC to Europe/Tallinn) robustly using `date-fns` or native `Intl`.
4. **Calculations:** Electricity prices should be displayed in cents/kWh (the API provides €/MWh). VAT (22%) toggle must be respected in all displayed price metrics and charts.

# Git rules
- Use conventional commits.
- Use imperative mood for commit messages.
- Commit after each task is completed.
- Do not commit `node_modules` or `.next` folders.

## AI Assistant Rules
- Reference `AGENTS.md` and `implementation_plan.md` (in the `.gemini/antigravity` artifact folder) before making structural changes.
- Prioritize clear, concise, and focused pull requests/commits.
- Every time a task is completed and code is changed, run `npx next build` to validate that the web app is building successfully.

## Setup and Run
- Setup: `npm install`
- Run locally: `npm run dev`
- Build for production: `npm run build` && `npm start`
