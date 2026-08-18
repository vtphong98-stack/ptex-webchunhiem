import type { SchoolWeek } from "@/lib/types";

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

export const EXCEL_WEEK_COUNT = EXCEL_WEEK_RANGES.length;

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

export function buildExcelWeeks(): SchoolWeek[] {
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

export function getExcelWeek(weekNumber: number) {
  return buildExcelWeeks().find((week) => week.weekNumber === weekNumber) ?? null;
}
