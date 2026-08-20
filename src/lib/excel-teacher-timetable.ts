import * as XLSX from "xlsx";

export type TeacherTimetableGrid = {
  morning: Record<number, string[]>;   // period → [Mon..Sun] = class names
  afternoon: Record<number, string[]>;
  evening: Record<number, string[]>;
};

const MORNING_PERIODS = [1, 2, 3, 4, 5];
const AFTERNOON_PERIODS = [1, 2, 3, 4, 5];
const EVENING_PERIODS = [1, 2, 3];
const DAY_LABELS_7 = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"];

function parseSheet(
  workbook: XLSX.WorkBook,
  names: string[],
  periods: number[],
): Record<number, string[]> {
  const target: Record<number, string[]> = {};
  const sheetName = workbook.SheetNames.find((n) =>
    names.some((alias) => n.toLowerCase().includes(alias.toLowerCase())),
  );
  if (!sheetName) return target;
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
    workbook.Sheets[sheetName],
    { header: 1, defval: "" },
  );
  if (!rows.length) return target;

  const header = rows[0].map((c) => String(c).trim().toLowerCase());
  const periodCol = header.findIndex((c) => c.includes("tiết") || c === "tiet");
  const dayCols = DAY_LABELS_7.map((label) =>
    header.findIndex((c) => c.includes(label.toLowerCase())),
  );

  for (const row of rows.slice(1)) {
    const p = Number(row[periodCol >= 0 ? periodCol : 0]);
    if (!periods.includes(p)) continue;
    target[p] = dayCols.map((col, i) =>
      String(row[col >= 0 ? col : i + 1] ?? "").trim() || "-",
    );
  }
  return target;
}

export function parseTeacherTimetableWorkbook(buffer: ArrayBuffer): TeacherTimetableGrid {
  const workbook = XLSX.read(buffer, { type: "array" });
  return {
    morning: parseSheet(workbook, ["Sáng", "Sang", "Buổi Sáng", "Morning"], MORNING_PERIODS),
    afternoon: parseSheet(workbook, ["Chiều", "Chieu", "Buổi Chiều", "Afternoon"], AFTERNOON_PERIODS),
    evening: parseSheet(workbook, ["Tối", "Toi", "Buổi Tối", "Evening"], EVENING_PERIODS),
  };
}

export function buildTeacherTimetableTemplate() {
  const workbook = XLSX.utils.book_new();

  const guide = [
    ["Hướng dẫn — Lịch Dạy Giáo Viên"],
    ["1. Mỗi sheet là 1 buổi (Sáng / Chiều / Tối)."],
    ["2. Mỗi ô ghi TÊN LỚP đang dạy tiết đó (VD: 12C1, 11B1, HSG, TT12-ONLINE...)."],
    ["3. Ô trống hoặc '-' = không có tiết."],
    ["4. Lưu file .xlsx rồi tải lên trang GVCN → tab Lịch dạy."],
    [""],
    ["Ví dụ:"],
    ["Tiết", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"],
    [1, "-", "-", "12C1", "-", "11B1", "HSG", "HSG"],
    [2, "-", "-", "12C1", "-", "11B1", "HSG", "HSG"],
  ];

  const makePeriods = (periods: number[]) => [
    ["Tiết", ...DAY_LABELS_7],
    ...periods.map((p) => [p, "", "", "", "", "", "", ""]),
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), "Hướng dẫn");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makePeriods(MORNING_PERIODS)), "Sáng");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makePeriods(AFTERNOON_PERIODS)), "Chiều");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makePeriods(EVENING_PERIODS)), "Tối");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function emptyTeacherTimetableGrid(): TeacherTimetableGrid {
  return {
    morning: Object.fromEntries(MORNING_PERIODS.map((p) => [p, Array(7).fill("-")])),
    afternoon: Object.fromEntries(AFTERNOON_PERIODS.map((p) => [p, Array(7).fill("-")])),
    evening: Object.fromEntries(EVENING_PERIODS.map((p) => [p, Array(7).fill("-")])),
  };
}
