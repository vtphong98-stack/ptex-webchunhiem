import * as XLSX from "xlsx";

export type TeacherTimetableGrid = {
  morning: Record<number, string[]>;   // period → [Mon..Sun] = class names
  afternoon: Record<number, string[]>;
  evening: Record<number, string[]>;
};

export const TEACHER_MORNING_PERIODS = [1, 2, 3, 4, 5];
export const TEACHER_AFTERNOON_PERIODS = [1, 2, 3, 4, 5];
export const TEACHER_EVENING_PERIODS = [1, 2, 3];
/** Lịch dạy có cả chủ nhật — dạy thêm, bồi dưỡng HSG hay rơi vào cuối tuần. */
export const TEACHER_DAY_LABELS = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"];

const MORNING_PERIODS = TEACHER_MORNING_PERIODS;
const AFTERNOON_PERIODS = TEACHER_AFTERNOON_PERIODS;
const EVENING_PERIODS = TEACHER_EVENING_PERIODS;
const DAY_LABELS_7 = TEACHER_DAY_LABELS;
const MAX_CELL = 40;

/**
 * Lọc lưới lịch dạy do màn hình gõ trực tiếp gửi lên: đúng số tiết, đúng bảy
 * ngày, chuỗi cắt ngắn — để dữ liệu gõ tay và dữ liệu từ Excel cùng một khuôn.
 */
export function sanitizeTeacherTimetableGrid(raw: unknown): TeacherTimetableGrid | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<TeacherTimetableGrid>;
  if (!input.morning || !input.afternoon || !input.evening) return null;

  const session = (source: Record<number, string[]> | undefined, periods: number[]) =>
    Object.fromEntries(
      periods.map((period) => {
        const cells = (source ?? {})[period] ?? [];
        return [
          period,
          DAY_LABELS_7.map((_, day) => {
            const value = String((Array.isArray(cells) ? cells[day] : "") ?? "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, MAX_CELL);
            return value || "-";
          }),
        ];
      }),
    );

  return {
    morning: session(input.morning, MORNING_PERIODS),
    afternoon: session(input.afternoon, AFTERNOON_PERIODS),
    evening: session(input.evening, EVENING_PERIODS),
  };
}

export function parseStoredTeacherTimetable(raw?: string | null): TeacherTimetableGrid | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TeacherTimetableGrid;
    if (!parsed?.morning || !parsed?.afternoon || !parsed?.evening) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
