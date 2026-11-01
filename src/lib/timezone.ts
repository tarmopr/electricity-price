/**
 * Timezone helpers for Europe/Tallinn (EET/EEST).
 *
 * All display-layer date operations must go through these helpers to ensure
 * consistent Tallinn-local results regardless of the browser's local timezone.
 */

const TALLINN_TZ = "Europe/Tallinn";

/**
 * Returns the hour (0–23) in Europe/Tallinn timezone for the given Date.
 */
export function getTallinnHour(date: Date): number {
  return parseInt(
    date.toLocaleString("en-US", {
      timeZone: TALLINN_TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }),
    10
  );
}

/**
 * Returns the date string in YYYY-MM-DD format in Europe/Tallinn timezone.
 */
export function getTallinnDateStr(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TALLINN_TZ });
}

/**
 * Returns the weekday (0=Sun … 6=Sat) in Europe/Tallinn timezone.
 * Uses noon on the local date to avoid any DST edge when constructing
 * the intermediate Date used to call getDay().
 */
export function getTallinnWeekday(date: Date): number {
  const dateStr = getTallinnDateStr(date);
  return new Date(dateStr + "T12:00:00").getDay();
}

/**
 * Returns all three date parts in Europe/Tallinn timezone in one call.
 */
export function getTallinnDateParts(date: Date): {
  dateStr: string;
  hour: number;
  weekday: number;
} {
  const dateStr = getTallinnDateStr(date);
  const hour = getTallinnHour(date);
  const weekday = new Date(dateStr + "T12:00:00").getDay();
  return { dateStr, hour, weekday };
}

const HOUR_MS = 3_600_000;

const TALLINN_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TALLINN_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const TALLINN_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TALLINN_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const TALLINN_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TALLINN_TZ,
  weekday: "short",
});

/**
 * Returns the UTC offset of Europe/Tallinn at the given instant, in milliseconds
 * (e.g. +2h in winter / EET, +3h in summer / EEST).
 */
export function getTallinnOffsetMs(date: Date): number {
  const parts = TALLINN_PARTS_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  const instantSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return wallAsUtc - instantSeconds;
}

/** Adds `days` calendar days to a 'YYYY-MM-DD' string (pure calendar math, tz-independent). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Converts a Tallinn wall-clock time on a Tallinn calendar date to the UTC instant.
 * DST-safe: the offset is resolved at the target instant, not at "now".
 * Non-existent wall times (spring-forward gap) resolve to the shifted-forward instant;
 * ambiguous wall times (fall-back repeated hour) resolve to the later occurrence.
 */
export function tallinnWallTimeToUtc(dateStr: string, hour: number, minute: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hour, minute);
  let guess = wallAsUtc - getTallinnOffsetMs(new Date(wallAsUtc));
  guess = wallAsUtc - getTallinnOffsetMs(new Date(guess));
  return new Date(guess);
}

/** True for a valid 24h "HH:MM" string. */
export function isValidHHMM(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Returns the next instant strictly after `now` at which the Tallinn wall clock
 * shows `hhmm` ("HH:MM"). If today's occurrence has already passed (or is exactly
 * now), tomorrow's occurrence is returned.
 */
export function getNextTallinnOccurrence(hhmm: string, now: Date): Date {
  const [hour, minute] = hhmm.split(":").map(Number);
  const today = getTallinnDateStr(now);
  const candidate = tallinnWallTimeToUtc(today, hour, minute);
  if (candidate.getTime() > now.getTime()) return candidate;
  return tallinnWallTimeToUtc(addDaysToDateStr(today, 1), hour, minute);
}

/** Last millisecond of tomorrow in Tallinn local time. */
export function getEndOfTomorrowTallinn(now: Date): Date {
  const dayAfterTomorrow = addDaysToDateStr(getTallinnDateStr(now), 2);
  return new Date(tallinnWallTimeToUtc(dayAfterTomorrow, 0, 0).getTime() - 1);
}

/**
 * Floors an instant to the start of its hour. Tallinn offsets are whole hours,
 * so UTC flooring equals Tallinn-local flooring.
 */
export function floorToHour(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);
}

/** Formats an instant as "HH:mm" in Tallinn time. */
export function formatTallinnTime(date: Date): string {
  return TALLINN_TIME_FORMATTER.format(date);
}

/**
 * Relative day label in Tallinn time: "Today" / "Tomorrow" / "Sat".
 * With `allowTonight`, a start later today from 18:00 — or, when it is already
 * evening (now ≥ 18:00), early tomorrow before 06:00 — reads as "Tonight".
 */
function tallinnDayLabel(date: Date, now: Date, allowTonight: boolean): string {
  const dateStr = getTallinnDateStr(date);
  const today = getTallinnDateStr(now);
  const tomorrow = addDaysToDateStr(today, 1);
  if (allowTonight) {
    if (dateStr === today && getTallinnHour(date) >= 18) return "Tonight";
    if (dateStr === tomorrow && getTallinnHour(now) >= 18 && getTallinnHour(date) < 6) return "Tonight";
  }
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return TALLINN_WEEKDAY_FORMATTER.format(date);
}

/**
 * Formats a time range with day context in Tallinn time, e.g.
 * "Today 13:00–15:00", "Tonight 22:00 – Tomorrow 06:00", "Tonight 01:15–09:15",
 * "Sat 01:15–09:15". An end exactly at midnight is treated as belonging to the
 * start's day. When the range crosses midnight the end carries its own day label.
 */
export function formatTallinnRange(start: Date, end: Date, now: Date): string {
  const startTime = formatTallinnTime(start);
  const endTime = formatTallinnTime(end);
  const startLabel = tallinnDayLabel(start, now, true);
  // Use end - 1ms for the day context so a window ending at 00:00 stays on the same day
  const endDayRef = new Date(Math.max(start.getTime(), end.getTime() - 1));
  if (getTallinnDateStr(endDayRef) === getTallinnDateStr(start)) {
    return `${startLabel} ${startTime}–${endTime}`;
  }
  return `${startLabel} ${startTime} – ${tallinnDayLabel(endDayRef, now, false)} ${endTime}`;
}

/**
 * Formats a future clock time in Tallinn time, adding a day label only when needed.
 * Within the next 24 h a bare "07:00" is unambiguous (it reads as the next 07:00);
 * further out it becomes "tomorrow 07:00" / "Sun 07:00".
 */
export function formatTallinnDeadline(deadline: Date, now: Date): string {
  const aheadMs = deadline.getTime() - now.getTime();
  if (aheadMs >= 0 && aheadMs < 24 * HOUR_MS) return formatTallinnTime(deadline);
  const label = tallinnDayLabel(deadline, now, false);
  const day = label === "Today" || label === "Tomorrow" ? label.toLowerCase() : label;
  return `${day} ${formatTallinnTime(deadline)}`;
}
