import type { SchoolWeek } from "@/lib/types";

export const CURRENT_SCHOOL_YEAR = "2026-2027";
export const ARCHIVE_SCHOOL_YEAR = "2025-2026";
export const CURRENT_CLASS_NAME = "12A1";

export type Milestone = {
  id: string;
  label: string;
  date: string;
  iso: string;
};

export const YEAR_MILESTONES: Milestone[] = [
  { id: "tuu-truong", label: "Tựu trường", date: "24/8/2026", iso: "2026-08-24" },
  { id: "khai-giang", label: "Khai giảng", date: "5/9/2026", iso: "2026-09-05" },
  { id: "thuc-hoc", label: "Thực học", date: "7/9/2026", iso: "2026-09-07" },
  { id: "hsg-casio", label: "HSG Casio (dự kiến)", date: "15/11/2026", iso: "2026-11-15" },
  { id: "hsg", label: "Thi HSG (dự kiến)", date: "12/12/2026", iso: "2026-12-12" },
  { id: "hk1", label: "Thi học kỳ 1", date: "4/1/2027", iso: "2027-01-04" },
  { id: "hk2", label: "Thi học kỳ 2", date: "10/5/2027", iso: "2027-05-10" },
  { id: "thi-thu", label: "Thi thử tốt nghiệp (dự kiến)", date: "20/5/2027", iso: "2027-05-20" },
  { id: "tn", label: "Thi tốt nghiệp THPT", date: "11/6/2027", iso: "2027-06-11" },
];

/** Weeks 23–24 ≈ Tết 2027 (2 tuần). */
const EMPTY_WEEK_NUMBERS = new Set([23, 24]);

function utcDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number) {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate() + days);
}

function vnDate(date: Date) {
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

function weekFromMonday(weekNumber: number, monday: Date): SchoolWeek {
  if (EMPTY_WEEK_NUMBERS.has(weekNumber)) {
    return { weekNumber, label: `Tuần ${weekNumber}`, startDate: "", endDate: "", dateRangeLabel: "" };
  }
  const saturday = addUtcDays(monday, 5);
  return {
    weekNumber,
    label: `Tuần ${weekNumber}`,
    startDate: monday.toISOString(),
    endDate: saturday.toISOString(),
    dateRangeLabel: `từ ngày ${vnDate(monday)} đến ${vnDate(saturday)}`,
  };
}

/** HK1: 7/9/2026–10/1/2027 (18 tuần). HK2: 11/1/2027–23/5/2027 (17 tuần thực học). */
export function buildWeeks2026(): SchoolWeek[] {
  const start = utcDay(2026, 9, 7);
  return Array.from({ length: 35 }, (_, index) => {
    const weekNumber = index + 1;
    const monday = addUtcDays(start, index * 7);
    return weekFromMonday(weekNumber, monday);
  });
}

export const EXCEL_WEEK_COUNT = 35;

export function buildWeeksForYear(name: string): SchoolWeek[] {
  if (name === ARCHIVE_SCHOOL_YEAR) {
    return [];
  }
  return buildWeeks2026();
}
