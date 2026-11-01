import { describe, it, expect, vi } from "vitest";
import {
  addDaysToDateStr,
  floorToHour,
  formatTallinnDeadline,
  formatTallinnRange,
  formatTallinnTime,
  getEndOfTomorrowTallinn,
  getNextTallinnOccurrence,
  getTallinnOffsetMs,
  isValidHHMM,
  tallinnWallTimeToUtc,
} from "@/lib/timezone";

const HOUR = 3_600_000;

describe("timezone helpers", () => {
  // ─── Offsets & wall-time conversion ────────────────────────────────────────

  describe("getTallinnOffsetMs", () => {
    it("is +2h in winter (EET) and +3h in summer (EEST)", () => {
      expect(getTallinnOffsetMs(new Date("2024-01-15T12:00:00Z"))).toBe(2 * HOUR);
      expect(getTallinnOffsetMs(new Date("2024-07-15T12:00:00Z"))).toBe(3 * HOUR);
    });

    it("throws instead of returning a wrong offset when Intl omits a date part", () => {
      // A missing part used to read as 0 (e.g. year 0), silently shifting every aggregate
      const spy = vi
        .spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
        .mockReturnValue([{ type: "month", value: "01" }]);
      try {
        expect(() => getTallinnOffsetMs(new Date("2024-01-15T12:00:00Z"))).toThrow(/year/);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("tallinnWallTimeToUtc", () => {
    it("converts winter and summer wall times", () => {
      expect(tallinnWallTimeToUtc("2024-01-15", 7, 0).toISOString()).toBe("2024-01-15T05:00:00.000Z");
      expect(tallinnWallTimeToUtc("2024-07-15", 7, 0).toISOString()).toBe("2024-07-15T04:00:00.000Z");
    });

    it("handles 15-minute wall times", () => {
      expect(tallinnWallTimeToUtc("2024-07-15", 22, 45).toISOString()).toBe("2024-07-15T19:45:00.000Z");
    });
  });

  describe("addDaysToDateStr", () => {
    it("crosses month and year boundaries", () => {
      expect(addDaysToDateStr("2024-01-31", 1)).toBe("2024-02-01");
      expect(addDaysToDateStr("2024-12-31", 1)).toBe("2025-01-01");
      expect(addDaysToDateStr("2024-03-01", -1)).toBe("2024-02-29");
    });
  });

  describe("isValidHHMM", () => {
    it("accepts valid 24h times and rejects others", () => {
      expect(isValidHHMM("07:00")).toBe(true);
      expect(isValidHHMM("23:59")).toBe(true);
      expect(isValidHHMM("24:00")).toBe(false);
      expect(isValidHHMM("7:00")).toBe(false);
      expect(isValidHHMM("")).toBe(false);
      expect(isValidHHMM(null)).toBe(false);
      expect(isValidHHMM(22)).toBe(false);
    });
  });

  // ─── Ready-by next occurrence ──────────────────────────────────────────────

  describe("getNextTallinnOccurrence", () => {
    it("returns today's occurrence when it is still ahead", () => {
      // 05:00 Tallinn (EEST) → 07:00 today
      const now = new Date("2024-06-15T02:00:00Z");
      expect(getNextTallinnOccurrence("07:00", now).toISOString()).toBe("2024-06-15T04:00:00.000Z");
    });

    it("rolls to tomorrow when the time already passed today", () => {
      // 20:00 Tallinn → next 07:00 is tomorrow
      const now = new Date("2024-06-15T17:00:00Z");
      expect(getNextTallinnOccurrence("07:00", now).toISOString()).toBe("2024-06-16T04:00:00.000Z");
    });

    it("rolls to tomorrow when now is exactly the ready-by time (strictly after)", () => {
      const now = new Date("2024-06-15T04:00:00Z"); // 07:00 Tallinn
      expect(getNextTallinnOccurrence("07:00", now).toISOString()).toBe("2024-06-16T04:00:00.000Z");
    });

    it("uses Tallinn date, not UTC date, around midnight", () => {
      // 2024-06-15T22:30Z = 01:30 Tallinn on Jun 16 → 07:00 on Jun 16
      const now = new Date("2024-06-15T22:30:00Z");
      expect(getNextTallinnOccurrence("07:00", now).toISOString()).toBe("2024-06-16T04:00:00.000Z");
    });

    it("is DST-safe across the autumn fall-back (EEST → EET)", () => {
      // Sun 27 Oct 2024, 01:00 EEST. Clocks go back 04:00 → 03:00, so 07:00 is EET (UTC+2)
      const now = new Date("2024-10-26T22:00:00Z");
      expect(getNextTallinnOccurrence("07:00", now).toISOString()).toBe("2024-10-27T05:00:00.000Z");
    });

    it("is DST-safe across the spring-forward (EET → EEST)", () => {
      // Sun 31 Mar 2024, 00:00 EET. Clocks jump 03:00 → 04:00, so 07:00 is EEST (UTC+3)
      const now = new Date("2024-03-30T22:00:00Z");
      expect(getNextTallinnOccurrence("07:00", now).toISOString()).toBe("2024-03-31T04:00:00.000Z");
    });
  });

  describe("getEndOfTomorrowTallinn", () => {
    it("returns the last millisecond of tomorrow in Tallinn", () => {
      const now = new Date("2024-06-15T10:00:00Z"); // 13:00 Tallinn Jun 15
      // Jun 17 00:00 EEST = Jun 16 21:00Z
      expect(getEndOfTomorrowTallinn(now).toISOString()).toBe("2024-06-16T20:59:59.999Z");
    });

    it("uses the Tallinn date late in the UTC evening", () => {
      const now = new Date("2024-06-15T22:00:00Z"); // 01:00 Tallinn Jun 16
      expect(getEndOfTomorrowTallinn(now).toISOString()).toBe("2024-06-17T20:59:59.999Z");
    });
  });

  describe("floorToHour", () => {
    it("floors to the start of the hour", () => {
      expect(floorToHour(new Date("2024-06-15T10:47:12.345Z")).toISOString()).toBe("2024-06-15T10:00:00.000Z");
    });
  });

  // ─── Formatting ────────────────────────────────────────────────────────────

  describe("formatTallinnTime", () => {
    it("formats HH:mm in Tallinn time", () => {
      expect(formatTallinnTime(new Date("2024-06-15T22:15:00Z"))).toBe("01:15");
    });
  });

  describe("formatTallinnDeadline", () => {
    const now = new Date("2024-06-14T17:00:00Z"); // Fri 20:00 Tallinn

    it("omits the day label within the next 24 hours", () => {
      expect(formatTallinnDeadline(new Date("2024-06-14T19:00:00Z"), now)).toBe("22:00");
      expect(formatTallinnDeadline(new Date("2024-06-15T04:00:00Z"), now)).toBe("07:00");
    });

    it("adds 'tomorrow' / weekday labels beyond 24 hours", () => {
      const morning = new Date("2024-06-14T03:30:00Z"); // Fri 06:30 Tallinn
      expect(formatTallinnDeadline(new Date("2024-06-15T04:00:00Z"), morning)).toBe("tomorrow 07:00");
      expect(formatTallinnDeadline(new Date("2024-06-16T04:00:00Z"), now)).toBe("Sun 07:00");
    });
  });

  describe("formatTallinnRange", () => {
    const now = new Date("2024-06-14T10:00:00Z"); // Fri 13:00 Tallinn

    it("same-day range today", () => {
      expect(
        formatTallinnRange(new Date("2024-06-14T10:00:00Z"), new Date("2024-06-14T12:00:00Z"), now)
      ).toBe("Today 13:00–15:00");
    });

    it("evening start today is 'Tonight' and crossing midnight shows both days", () => {
      expect(
        formatTallinnRange(new Date("2024-06-14T19:00:00Z"), new Date("2024-06-15T03:00:00Z"), now)
      ).toBe("Tonight 22:00 – Tomorrow 06:00");
    });

    it("tomorrow-only range during the day reads 'Tomorrow'", () => {
      expect(
        formatTallinnRange(new Date("2024-06-14T22:15:00Z"), new Date("2024-06-15T06:15:00Z"), now)
      ).toBe("Tomorrow 01:15–09:15");
    });

    it("in the evening, an early-tomorrow start (< 06:00) reads 'Tonight'", () => {
      const evening = new Date("2024-06-14T17:30:00Z"); // 20:30 Tallinn
      expect(
        formatTallinnRange(new Date("2024-06-14T22:15:00Z"), new Date("2024-06-15T06:15:00Z"), evening)
      ).toBe("Tonight 01:15–09:15");
    });

    it("in the evening, a tomorrow start at/after 06:00 still reads 'Tomorrow'", () => {
      const evening = new Date("2024-06-14T17:30:00Z");
      expect(
        formatTallinnRange(new Date("2024-06-15T03:00:00Z"), new Date("2024-06-15T05:00:00Z"), evening)
      ).toBe("Tomorrow 06:00–08:00");
    });

    it("in the evening, a window crossing midnight labels the end 'Tomorrow'", () => {
      const evening = new Date("2024-06-14T17:30:00Z");
      expect(
        formatTallinnRange(new Date("2024-06-14T20:00:00Z"), new Date("2024-06-15T04:00:00Z"), evening)
      ).toBe("Tonight 23:00 – Tomorrow 07:00");
    });

    it("just after midnight (not evening), a same-day window reads 'Today'", () => {
      const lateNight = new Date("2024-06-14T21:30:00Z"); // 00:30 Tallinn Jun 15
      expect(
        formatTallinnRange(new Date("2024-06-14T22:00:00Z"), new Date("2024-06-15T03:00:00Z"), lateNight)
      ).toBe("Today 01:00–06:00");
    });

    it("uses weekday for later days", () => {
      expect(
        formatTallinnRange(new Date("2024-06-15T22:15:00Z"), new Date("2024-06-16T06:15:00Z"), now)
      ).toBe("Sun 01:15–09:15");
    });

    it("an end exactly at midnight stays on the start day", () => {
      expect(
        formatTallinnRange(new Date("2024-06-14T17:00:00Z"), new Date("2024-06-14T21:00:00Z"), now)
      ).toBe("Tonight 20:00–00:00");
    });
  });
});

describe("getEndOfTomorrowTallinn across DST", () => {
  it("covers a 25 h tomorrow on the autumn fall-back day", () => {
    // Sat 24 Oct 2026 13:00 EEST → Sun 25 Oct ends 23:59:59.999 EET = 21:59:59.999Z
    expect(getEndOfTomorrowTallinn(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe("2026-10-25T21:59:59.999Z");
  });

  it("covers a 23 h tomorrow on the spring-forward day", () => {
    // Sat 28 Mar 2026 12:00 EET → Sun 29 Mar ends 23:59:59.999 EEST = 20:59:59.999Z
    expect(getEndOfTomorrowTallinn(new Date("2026-03-28T10:00:00Z")).toISOString()).toBe("2026-03-29T20:59:59.999Z");
  });
});

describe("tallinnWallTimeToUtc DST edge cases", () => {
  it("moves a wall time inside the spring-forward gap forward", () => {
    expect(tallinnWallTimeToUtc("2026-03-29", 3, 30).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("resolves the repeated fall-back hour to its later occurrence", () => {
    expect(tallinnWallTimeToUtc("2026-10-25", 3, 30).toISOString()).toBe("2026-10-25T01:30:00.000Z");
  });
});
