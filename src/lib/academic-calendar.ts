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

export function isoToVnDate(iso: string): string {
  if (!iso) return "";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  return `${day}/${month}/${year}`;
}

export function vnDateToIso(vnDate: string): string {
  if (!vnDate) return "";
  const parts = vnDate.trim().split(/[\/\-]/);
  if (parts.length !== 3) return vnDate;
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

export function parseMilestonesJson(raw?: string | null): Milestone[] {
  if (!raw) return YEAR_MILESTONES;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {}
  return YEAR_MILESTONES;
}

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
  const saturday = addUtcDays(monday, 5);
  return {
    weekNumber,
    label: `Tuần ${weekNumber}`,
    startDate: monday.toISOString(),
    endDate: saturday.toISOString(),
    dateRangeLabel: `từ ngày ${vnDate(monday)} đến ${vnDate(saturday)}`,
  };
}

/** 
 * 35 tuần THỰC HỌC (HK1: 18 tuần, HK2: 17 tuần).
 * Nghỉ Tết 2 tuần (08/02/2027 – 21/02/2027) không tính vào số tuần thực học.
 * Tuần 23 thực học bắt đầu từ thứ Hai 22/02/2027.
 */
export function buildWeeks2026(milestones?: Milestone[]): SchoolWeek[] {
  const thucHocMs = milestones?.find((m) => m.id === "thuc-hoc")?.iso;
  let start = utcDay(2026, 9, 7);
  if (thucHocMs) {
    const p = thucHocMs.split("-").map(Number);
    if (p.length === 3 && p[0] && p[1] && p[2]) {
      start = utcDay(p[0], p[1], p[2]);
    }
  }
  return Array.from({ length: 35 }, (_, index) => {
    const weekNumber = index + 1;
    // Bỏ qua 2 tuần nghỉ Tết cho các tuần từ Tuần 23 trở đi
    const offsetWeeks = weekNumber <= 22 ? index : index + 2;
    const monday = addUtcDays(start, offsetWeeks * 7);
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
