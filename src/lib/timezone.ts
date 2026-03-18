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
