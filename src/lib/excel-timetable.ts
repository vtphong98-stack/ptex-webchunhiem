import * as XLSX from "xlsx";

import { DAY_LABELS, SUBJECT_CLASS, SUBJECT_TEACHERS, type TimetableCell } from "@/lib/class-site";

export type TimetableGrid = {
  morning: Record<number, string[]>;
  afternoon: Record<number, string[]>;
};

const MORNING_PERIODS = [1, 2, 3, 4, 5];
const AFTERNOON_PERIODS = [2, 3, 4, 5];

function cellsFromSubjects(subjects: string[]): TimetableCell[] {
  return subjects.map((subject) => {
    const name = subject.trim() || "-";
    if (name === "-") return { subject: "-" };
    return {
      subject: name,
      teacher: SUBJECT_TEACHERS[name],
      className: SUBJECT_CLASS[name],
    };
  });
}

function applyRowspan(rows: Record<number, TimetableCell[]>, periods: number[]) {
  const next: Record<number, TimetableCell[]> = {};
  for (const period of periods) {
    next[period] = (rows[period] ?? Array.from({ length: 6 }, () => ({ subject: "-" }))).map((cell) => ({ ...cell }));
  }
  for (let day = 0; day < 6; day += 1) {
    let i = 0;
    while (i < periods.length) {
      const period = periods[i];
      const subject = next[period][day].subject;
      let span = 1;
      while (i + span < periods.length && next[periods[i + span]][day].subject === subject && subject !== "-") {
        next[periods[i + span]][day].skip = true;
        span += 1;
      }
      if (span > 1) next[period][day].rowspan = span;
      i += span;
    }
  }
  return next;
}

export function emptyTimetableGrid(): TimetableGrid {
  return {
    morning: Object.fromEntries(MORNING_PERIODS.map((period) => [period, Array.from({ length: 6 }, () => "")])),
    afternoon: Object.fromEntries(AFTERNOON_PERIODS.map((period) => [period, Array.from({ length: 6 }, () => "")])),
  };
}

export function parseTimetableWorkbook(buffer: ArrayBuffer): TimetableGrid {
  const workbook = XLSX.read(buffer, { type: "array" });
  const grid = emptyTimetableGrid();
  parseSheet(workbook, ["Sáng", "Sang", "Buổi Sáng"], grid.morning, MORNING_PERIODS);
  parseSheet(workbook, ["Chiều", "Chieu", "Trái Buổi"], grid.afternoon, AFTERNOON_PERIODS);
  return grid;
}

function parseSheet(
  workbook: XLSX.WorkBook,
  names: string[],
  target: Record<number, string[]>,
  periods: number[],
) {
  const sheetName = workbook.SheetNames.find((name) => names.some((alias) => name.toLowerCase().includes(alias.toLowerCase())));
  if (!sheetName) return;
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
  if (!rows.length) return;
  const header = rows[0].map((cell) => String(cell).trim().toLowerCase());
  const periodCol = header.findIndex((cell) => cell.includes("tiết") || cell === "tiet");
  const dayCols = DAY_LABELS.map((label) => header.findIndex((cell) => cell.includes(label.toLowerCase())));
  for (const row of rows.slice(1)) {
    const period = Number(row[periodCol >= 0 ? periodCol : 0]);
    if (!periods.includes(period)) continue;
    target[period] = dayCols.map((col, index) => String(row[col >= 0 ? col : index + 1] ?? "").trim());
  }
}

export function buildTimetableTemplate() {
  const workbook = XLSX.utils.book_new();
  const morning = [
    ["Tiết", ...DAY_LABELS],
    ...MORNING_PERIODS.map((period) => [period, "", "", "", "", "", ""]),
  ];
  const afternoon = [
    ["Tiết", ...DAY_LABELS],
    ...AFTERNOON_PERIODS.map((period) => [period, "", "", "", "", "", ""]),
  ];
  const guide = [
    ["Hướng dẫn"],
    ["1. Gõ môn vào ô (Toán, Văn, Anh, Sử, Địa, Tin, GDTC, GDQP, ...)."],
    ["2. Ô trống hoặc '-' = không có tiết."],
    ["3. Sheet Sáng: tiết 1–5. Sheet Chiều: tiết 2–5."],
    ["4. Lưu file .xlsx rồi tải lên trang GVCN."],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), "Hướng dẫn");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(morning), "Sáng");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(afternoon), "Chiều");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function timetableDisplayFromGrid(grid: TimetableGrid) {
  const morningRows = Object.fromEntries(
    MORNING_PERIODS.map((period) => [period, cellsFromSubjects(grid.morning[period] ?? Array.from({ length: 6 }, () => "-"))]),
  );
  const afternoonRows = Object.fromEntries(
    AFTERNOON_PERIODS.map((period) => [period, cellsFromSubjects(grid.afternoon[period] ?? Array.from({ length: 6 }, () => "-"))]),
  );
  return {
    morning: applyRowspan(morningRows, MORNING_PERIODS),
    afternoon: applyRowspan(afternoonRows, AFTERNOON_PERIODS),
  };
}

export function parseStoredTimetable(raw?: string | null): TimetableGrid | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TimetableGrid;
    if (!parsed?.morning || !parsed?.afternoon) return null;
    return parsed;
  } catch {
    return null;
  }
}
