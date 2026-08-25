import * as XLSX from "xlsx";

import { DAY_LABELS, SUBJECT_TEACHERS, canonicalSubject, subjectStyle, type TimetableCell } from "@/lib/class-site";

export type TimetableGrid = {
  morning: Record<number, string[]>;
  afternoon: Record<number, string[]>;
  /**
   * Môn → tên giáo viên dạy, lấy từ sheet "Giáo viên" của file GVCN tải lên.
   * Trước đây tên giáo viên là hằng số trong mã nguồn nên đổi phân công phải
   * sửa code; giờ nằm cùng thời khóa biểu và theo từng năm học.
   */
  teachers?: Record<string, string>;
};

const MORNING_PERIODS = [1, 2, 3, 4, 5];
const AFTERNOON_PERIODS = [2, 3, 4, 5];
/** Tên sheet chứa bảng phân công "Môn | Giáo viên dạy". */
const TEACHER_SHEET = "Giáo viên";

function subjectLabel(raw: unknown): string {
  if (raw && typeof raw === "object" && "subject" in raw) {
    return String((raw as { subject?: unknown }).subject ?? "").trim() || "-";
  }
  return String(raw ?? "").trim() || "-";
}

/**
 * Tách ô ghi kiểu "Toán: Võ Thanh Phong" hoặc "Toán - Võ Thanh Phong".
 *
 * Nhiều thầy cô gõ thẳng tên giáo viên vào ô thay vì điền bảng phân công, nên
 * nhận luôn cả hai cách. Chỉ tách ở dấu hai chấm hoặc gạch ngang có khoảng
 * trắng hai bên, để tên môn như "CN(CN)" hay "GDKT&PL" không bị cắt nhầm.
 */
export function splitSubjectTeacher(raw: string) {
  const value = raw.trim();
  const match = value.match(/^([^:]+?)\s*(?::|\s-\s)\s*(.+)$/);
  if (!match) return { subject: value, teacher: "" };
  return { subject: match[1].trim(), teacher: match[2].trim() };
}

function cellsFromSubjects(subjects: unknown[], teachers: Record<string, string>): TimetableCell[] {
  return subjects.map((subject) => {
    const { subject: name, teacher } = splitSubjectTeacher(subjectLabel(subject));
    const style = subjectStyle(name);
    // Tên giáo viên trong file luôn thắng bảng mặc định trong mã nguồn.
    const assigned = teacher || teachers[canonicalSubject(name)] || "";
    return assigned ? { ...style, teacher: assigned } : style;
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
    teachers: {},
  };
}

/** Bảng phân công trong sheet "Giáo viên": cột 1 tên môn, cột 2 tên thầy cô. */
function parseTeacherSheet(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames.find((name) =>
    /giáo\s*viên|giao\s*vien|phân\s*công|phan\s*cong/i.test(name),
  );
  const teachers: Record<string, string> = {};
  if (!sheetName) return teachers;

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  for (const row of rows) {
    const subject = String(row[0] ?? "").trim();
    const teacher = String(row[1] ?? "").trim();
    if (!subject || !teacher) continue;
    if (/^môn$|^mon$/i.test(subject)) continue; // dòng tiêu đề
    teachers[canonicalSubject(subject)] = teacher;
  }
  return teachers;
}

export function parseTimetableWorkbook(buffer: ArrayBuffer): TimetableGrid {
  const workbook = XLSX.read(buffer, { type: "array" });
  const grid = emptyTimetableGrid();
  parseSheet(workbook, ["Sáng", "Sang", "Buổi Sáng"], grid.morning, MORNING_PERIODS);
  parseSheet(workbook, ["Chiều", "Chieu", "Trái Buổi"], grid.afternoon, AFTERNOON_PERIODS);

  const teachers = parseTeacherSheet(workbook);
  // Ô gõ kiểu "Toán: Võ Thanh Phong" cũng tính là một dòng phân công, và ô thì
  // chỉ giữ lại tên môn cho gọn.
  for (const session of [grid.morning, grid.afternoon]) {
    for (const [period, cells] of Object.entries(session)) {
      session[Number(period)] = cells.map((cell) => {
        const { subject, teacher } = splitSubjectTeacher(cell);
        if (teacher) teachers[canonicalSubject(subject)] = teacher;
        return subject;
      });
    }
  }
  grid.teachers = teachers;
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

function sessionRows(grid: TimetableGrid | null, key: "morning" | "afternoon", periods: number[]) {
  return periods.map((period) => {
    const cells = grid?.[key]?.[period] ?? [];
    return [period, ...Array.from({ length: 6 }, (_, day) => cells[day] ?? "")];
  });
}

/**
 * Các môn cần có dòng trong bảng phân công: môn đang dùng trong TKB, môn GVCN
 * đã tự thêm vào bảng lần trước, cộng danh sách môn app biết sẵn. Thiếu vế thứ
 * hai thì môn tự thêm sẽ biến mất khỏi mẫu tải về lần sau.
 */
function templateSubjects(grid: TimetableGrid | null) {
  const used = new Set<string>();
  for (const key of ["morning", "afternoon"] as const) {
    for (const cells of Object.values(grid?.[key] ?? {})) {
      for (const cell of cells) {
        const name = canonicalSubject(splitSubjectTeacher(String(cell ?? "")).subject);
        if (name && name !== "-") used.add(name);
      }
    }
  }
  for (const name of Object.keys(grid?.teachers ?? {})) used.add(name);
  for (const name of Object.keys(SUBJECT_TEACHERS)) used.add(name);
  return [...used].sort((a, b) => a.localeCompare(b, "vi"));
}

/**
 * Mẫu TKB kèm bảng phân công giáo viên.
 *
 * Truyền TKB đang dùng vào thì mẫu tải về đã có sẵn môn và tên thầy cô, GVCN
 * chỉ sửa chỗ thay đổi thay vì gõ lại từ đầu.
 */
export function buildTimetableTemplate(current?: TimetableGrid | null) {
  const grid = current ?? null;
  const teachers = grid?.teachers ?? {};
  const workbook = XLSX.utils.book_new();

  const morning = [["Tiết", ...DAY_LABELS], ...sessionRows(grid, "morning", MORNING_PERIODS)];
  const afternoon = [["Tiết", ...DAY_LABELS], ...sessionRows(grid, "afternoon", AFTERNOON_PERIODS)];
  const teacherRows = [
    ["Môn", "Giáo viên dạy"],
    ...templateSubjects(grid).map((subject) => [subject, teachers[subject] ?? SUBJECT_TEACHERS[subject] ?? ""]),
  ];

  const guide = [
    ["Hướng dẫn"],
    ["1. Gõ môn vào ô (Toán, Văn, Anh, Sử, Địa, Tin, GDTC, GDQP, ...)."],
    ["2. Ô trống hoặc '-' = không có tiết."],
    ["3. Sheet Sáng: tiết 1–5. Sheet Chiều: tiết 2–5."],
    ["4. Sheet \"Giáo viên\": mỗi dòng một môn kèm tên thầy cô dạy môn đó."],
    ["   Tải lên xong, thời khóa biểu trên trang chủ hiện cả tên môn lẫn tên giáo viên."],
    ["   Thêm dòng mới nếu lớp có môn chưa có trong bảng."],
    ["5. Hoặc gõ thẳng vào ô theo kiểu \"Toán: Võ Thanh Phong\" — web tự tách môn và tên."],
    ["6. Lưu file .xlsx rồi tải lên trang GVCN."],
  ];

  const guideSheet = XLSX.utils.aoa_to_sheet(guide);
  guideSheet["!cols"] = [{ wch: 96 }];
  const teacherSheet = XLSX.utils.aoa_to_sheet(teacherRows);
  teacherSheet["!cols"] = [{ wch: 16 }, { wch: 28 }];
  const dayCols = [{ wch: 6 }, ...DAY_LABELS.map(() => ({ wch: 14 }))];
  const morningSheet = XLSX.utils.aoa_to_sheet(morning);
  morningSheet["!cols"] = dayCols;
  const afternoonSheet = XLSX.utils.aoa_to_sheet(afternoon);
  afternoonSheet["!cols"] = dayCols;

  XLSX.utils.book_append_sheet(workbook, guideSheet, "Hướng dẫn");
  XLSX.utils.book_append_sheet(workbook, morningSheet, "Sáng");
  XLSX.utils.book_append_sheet(workbook, afternoonSheet, "Chiều");
  XLSX.utils.book_append_sheet(workbook, teacherSheet, TEACHER_SHEET);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function timetableDisplayFromGrid(grid: TimetableGrid) {
  const teachers = grid.teachers ?? {};
  const morningRows = Object.fromEntries(
    MORNING_PERIODS.map((period) => [
      period,
      cellsFromSubjects(grid.morning[period] ?? Array.from({ length: 6 }, () => "-"), teachers),
    ]),
  );
  const afternoonRows = Object.fromEntries(
    AFTERNOON_PERIODS.map((period) => [
      period,
      cellsFromSubjects(grid.afternoon[period] ?? Array.from({ length: 6 }, () => "-"), teachers),
    ]),
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

export function timetableDisplayFromJson(raw?: string | null) {
  const stored = parseStoredTimetable(raw);
  return stored ? timetableDisplayFromGrid(stored) : null;
}
