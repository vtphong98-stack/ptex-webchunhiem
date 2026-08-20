import { buildWeeks2026 } from "@/lib/academic-calendar";
import type { SchoolWeek } from "@/lib/types";

export { EXCEL_WEEK_COUNT } from "@/lib/academic-calendar";

/** Date ranges copied from sheet LT column B of 12c1cn.xlsx (year 2025-2026). */
export const EXCEL_WEEK_RANGES: Array<{ weekNumber: number; range: string }> = [
  { weekNumber: 1, range: "từ ngày 8/9/2025 đến 13/9/2025" },
  { weekNumber: 2, range: "từ ngày 15/9/2025 đến 20/9/2025" },
  { weekNumber: 3, range: "từ ngày 22/9/2025 đến 27/9/2025" },
  { weekNumber: 4, range: "từ ngày 29/9/2025 đến 4/10/2025" },
  { weekNumber: 5, range: "từ ngày 6/10/2025 đến 11/10/2025" },
  { weekNumber: 6, range: "từ ngày 13/10/2025 đến 18/10/2025" },
  { weekNumber: 7, range: "từ ngày 20/10/2025 đến 25/10/2025" },
  { weekNumber: 8, range: "từ ngày 27/10/2025 đến 1/11/2025" },
  { weekNumber: 9, range: "từ ngày 3/11/2025 đến 8/11/2025" },
  { weekNumber: 10, range: "từ ngày 10/11/2025 đến 15/11/2025" },
  { weekNumber: 11, range: "từ ngày 17/11/2025 đến 22/11/2025" },
  { weekNumber: 12, range: "từ ngày 24/11/2025 đến 29/11/2025" },
  { weekNumber: 13, range: "từ ngày 1/12/2025 đến 6/12/2025" },
  { weekNumber: 14, range: "từ ngày 8/12/2025 đến 13/12/2025" },
  { weekNumber: 15, range: "từ ngày 15/12/2025 đến 20/12/2025" },
  { weekNumber: 16, range: "từ ngày 22/12/2025 đến 27/12/2025" },
  { weekNumber: 17, range: "" },
  { weekNumber: 18, range: "từ ngày 5/1/2026 đến 10/1/2026" },
  { weekNumber: 19, range: "từ ngày 12/01/2026 đến 17/01/2026" },
  { weekNumber: 20, range: "từ ngày 19/01/2026 đến 24/01/2026" },
  { weekNumber: 21, range: "" },
  { weekNumber: 22, range: "" },
  { weekNumber: 23, range: "từ ngày 23/02/2026 đến 28/02/2026" },
  { weekNumber: 24, range: "từ ngày 02/03/2026 đến 07/03/2026" },
  { weekNumber: 25, range: "từ ngày 09/03/2026 đến 14/03/2026" },
  { weekNumber: 26, range: "từ ngày 16/03/2026 đến 21/03/2026" },
  { weekNumber: 27, range: "từ ngày 23/03/2026 đến 28/03/2026" },
  { weekNumber: 28, range: "" },
  { weekNumber: 29, range: "" },
  { weekNumber: 30, range: "" },
  { weekNumber: 31, range: "" },
  { weekNumber: 32, range: "" },
  { weekNumber: 33, range: "" },
  { weekNumber: 34, range: "" },
  { weekNumber: 35, range: "" },
];

export const EXCEL_WEEK_COUNT_2025 = EXCEL_WEEK_RANGES.length;

function parseDayMonthYear(raw: string) {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

export function parseExcelWeekRange(range: string) {
  const match = range.match(/từ ngày\s+([\d/]+)\s+đến\s+([\d/]+)/i);
  if (!match) return { startDate: "", endDate: "" };
  const start = parseDayMonthYear(match[1]);
  const end = parseDayMonthYear(match[2]);
  return {
    startDate: start ? start.toISOString() : "",
    endDate: end ? end.toISOString() : "",
  };
}

export function formatWeekRangeShort(range: string) {
  const match = range.match(/từ ngày\s+([\d/]+)\s+đến\s+([\d/]+)/i);
  if (!match) return "";
  return `${match[1]} – ${match[2]}`;
}

export function buildWeeks2025(): SchoolWeek[] {
  return EXCEL_WEEK_RANGES.map((item) => {
    const dates = parseExcelWeekRange(item.range);
    return {
      weekNumber: item.weekNumber,
      label: `Tuần ${item.weekNumber}`,
      dateRangeLabel: item.range,
      startDate: dates.startDate,
      endDate: dates.endDate,
    };
  });
}

/**
 * Default = năm hiện hành 2026-2027.
 *
 * The 35-week table is derived from constants, so it never changes inside a
 * process. It used to be rebuilt (35 objects, ~70 Date allocations) on every
 * call, and the week-lock helpers call it dozens of times per request through
 * their default arguments.
 */
let excelWeeksCache: SchoolWeek[] | null = null;

export function buildExcelWeeks(): SchoolWeek[] {
  if (!excelWeeksCache) excelWeeksCache = buildWeeks2026();
  return excelWeeksCache;
}

export function getExcelWeek(weekNumber: number) {
  return buildExcelWeeks().find((week) => week.weekNumber === weekNumber) ?? null;
}

/**
 * Calculates the active school week based on REAL-TIME (current date/time in Vietnam).
 * - If current date is before Week 1 start (e.g. before 07/09/2026): returns Week 1.
 * - If current date falls within Week N: returns Week N.
 * - If current date is after Week 35: returns Week 35.
 */
export function getCurrentRealtimeWeekNumber(weeks = buildExcelWeeks(), now = new Date()): number {
  if (!weeks.length) return 1;

  const validWeeks = weeks.filter((w) => Boolean(w.startDate));
  if (!validWeeks.length) return 1;

  const nowMs = now.getTime();
  const firstWeekStartMs = new Date(validWeeks[0].startDate).getTime();

  // If before week 1 start date -> default to week 1
  if (nowMs < firstWeekStartMs) {
    return 1;
  }

  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    if (!w.startDate) continue;
    const startMs = new Date(w.startDate).getTime();

    // Find next week's start or 7 days after current week
    let nextStartMs = startMs + 7 * 86400000;
    for (let j = i + 1; j < weeks.length; j++) {
      if (weeks[j].startDate) {
        nextStartMs = new Date(weeks[j].startDate).getTime();
        break;
      }
    }

    if (nowMs >= startMs && nowMs < nextStartMs) {
      return w.weekNumber;
    }
  }

  return weeks[weeks.length - 1].weekNumber;
}

export function getCurrentRealtimeWeek(weeks = buildExcelWeeks(), now = new Date()): SchoolWeek {
  const weekNum = getCurrentRealtimeWeekNumber(weeks, now);
  return weeks.find((w) => w.weekNumber === weekNum) ?? weeks[0];
}

