/**
 * Rebuilds the calendar aggregates (daily, weekly, monthly, weekday-hour) of a
 * deployed app, one Tallinn month per request to POST /api/sync/recompute.
 * One request per month keeps each Worker invocation inside the Workers Free limits.
 *
 * Usage:
 *   SYNC_SECRET=… npm run recompute -- --url https://your-domain.com [--from YYYY-MM] [--to YYYY-MM]
 *
 * Without --from/--to the range is every month between the earliest and latest
 * stored price (GET /api/sync). Months with no stored data (404) are skipped; any
 * other failure stops the run and prints the --from value to resume with.
 *
 * Runs on Node ≥ 22.18 directly (built-in TypeScript type stripping), so it may
 * only use erasable TypeScript syntax and must not import from src/.
 */

import { pathToFileURL } from "node:url";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const TALLINN_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Tallinn",
  year: "numeric",
  month: "2-digit",
});

/** 'YYYY-MM' of an instant in Europe/Tallinn. */
export function tallinnMonth(iso: string): string {
  const parts = TALLINN_MONTH.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}`;
}

/** Every 'YYYY-MM' from `from` to `to`, both inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split("-").map(Number);
  for (;;) {
    const current = `${year}-${String(month).padStart(2, "0")}`;
    if (current > to) return months;
    months.push(current);
    if (++month > 12) {
      month = 1;
      year++;
    }
  }
}

export interface Args {
  url: string;
  from?: string;
  to?: string;
}

export function parseArgs(argv: string[]): Args {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split("=", 2);
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument: ${argv[i]}`);
    values[flag.slice(2)] = inline ?? argv[++i];
  }
  if (!values.url) throw new Error("Missing --url (e.g. --url https://your-domain.com)");
  for (const key of ["from", "to"]) {
    if (values[key] !== undefined && !MONTH.test(values[key])) {
      throw new Error(`--${key} must be YYYY-MM, got "${values[key]}"`);
    }
  }
  const args: Args = { url: values.url.replace(/\/+$/, "") };
  if (values.from) args.from = values.from;
  if (values.to) args.to = values.to;
  return args;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? "";
  } catch {
    return "";
  }
}

export async function recomputeMonths(options: Args & {
  secret: string;
  fetchFn?: FetchFn;
  log?: (line: string) => void;
}): Promise<{ done: string[]; skipped: string[] }> {
  const { url, secret, fetchFn = fetch, log = console.log } = options;
  let { from, to } = options;

  if (!from || !to) {
    const res = await fetchFn(`${url}/api/sync`);
    if (!res.ok) throw new Error(`GET /api/sync failed: HTTP ${res.status} ${await readError(res)}`);
    const { data } = (await res.json()) as {
      data: { earliestTimestamp: string | null; latestTimestamp: string | null };
    };
    if (!data.earliestTimestamp || !data.latestTimestamp) throw new Error("No prices stored yet");
    from ??= tallinnMonth(data.earliestTimestamp);
    to ??= tallinnMonth(data.latestTimestamp);
  }

  const headers: Record<string, string> = secret ? { Authorization: `Bearer ${secret}` } : {};
  const done: string[] = [];
  const skipped: string[] = [];
  for (const month of monthsBetween(from, to)) {
    const res = await fetchFn(`${url}/api/sync/recompute?month=${month}`, { method: "POST", headers });
    if (res.status === 404) {
      skipped.push(month);
      log(`${month}  skipped (no stored data)`);
      continue;
    }
    if (!res.ok) {
      throw new Error(
        `${month} failed: HTTP ${res.status} ${await readError(res)}. Resume with --from ${month}`
      );
    }
    const { data } = (await res.json()) as { data: { rows: Record<string, number> } };
    done.push(month);
    log(`${month}  ${JSON.stringify(data.rows)}`);
  }
  return { done, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = process.env.SYNC_SECRET ?? "";
  if (!secret) console.warn("SYNC_SECRET is not set: requests are sent without a bearer token");
  const { done, skipped } = await recomputeMonths({ ...args, secret });
  console.log(`Recomputed ${done.length} month(s), skipped ${skipped.length}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
