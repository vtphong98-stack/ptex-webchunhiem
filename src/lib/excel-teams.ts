import * as XLSX from "xlsx";

import { CLASS_SITE } from "@/lib/class-site";
import {
  CLASS_DUTY_LABELS,
  formatBirthDate,
  normalizePersonName,
  parseClassDuty,
  parseTeamRole,
  studentPositionLabel,
  TEAM_ROLE_LABELS,
} from "@/lib/team-roster";
import type { ClassDuty, Student, TeamRole } from "@/lib/types";

export type ImportedStudentRow = {
  fullName: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  teamNumber: number;
  teamRole: TeamRole | null;
  classDuty: ClassDuty | null;
  notes: string;
};

export type StudentExportRow = Student & {
  violationCount: number;
  absentDays: number;
};

const HEADERS = ["STT", "Họ và tên", "Ngày sinh", "Chức vụ tổ", "Chức vụ lớp", "Ghi chú"] as const;
const EXPORT_HEADERS = [
  "STT",
  "Họ và tên",
  "Ngày sinh",
  "Tổ",
  "Chức vụ",
  "Số lần vi phạm",
  "Số lượt nghỉ",
] as const;

function parseBirth(value: unknown): { birthDay: number; birthMonth: number; birthYear: number | null } {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return { birthDay: parsed.d, birthMonth: parsed.m, birthYear: parsed.y || null };
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      birthDay: value.getDate(),
      birthMonth: value.getMonth() + 1,
      birthYear: value.getFullYear(),
    };
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{4}))?$/);
  if (!match) return { birthDay: 1, birthMonth: 1, birthYear: null };
  return {
    birthDay: Number(match[1]),
    birthMonth: Number(match[2]),
    birthYear: match[3] ? Number(match[3]) : null,
  };
}

function headerIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function sheetTeamNumber(name: string) {
  const match = name.replace(/\s+/g, " ").trim().match(/(?:tổ|to|tt)\s*(\d)/i);
  if (!match) return null;
  const team = Number(match[1]);
  return team >= 1 && team <= 4 ? team : null;
}

function emptyTemplateRows(teamNumber: number) {
  return [
    [1, "", "", "Tổ trưởng", "", teamNumber === 1 ? "Dòng 1: tổ trưởng" : ""],
    [2, "", "", "Tổ phó", "", "Dòng 2: tổ phó"],
    ...Array.from({ length: 13 }, (_, index) => [index + 3, "", "", "Thành viên", "", ""]),
  ];
}

function studentToTemplateRow(student: Student, index: number) {
  const teamRole = student.teamRole === "toTruong"
    ? "Tổ trưởng"
    : student.teamRole === "toPho"
      ? "Tổ phó"
      : TEAM_ROLE_LABELS[student.teamRole ?? "thanhVien"];
  const classDuty = student.classDuty ? CLASS_DUTY_LABELS[student.classDuty] : "";
  return [index + 1, student.fullName, formatBirthDate(student), teamRole, classDuty, student.notes ?? ""];
}

export function buildTeamTemplateWorkbook(students: Student[] = []) {
  const workbook = XLSX.utils.book_new();
  const guide = XLSX.utils.aoa_to_sheet([
    ["Hướng dẫn chia tổ lớp " + CLASS_SITE.className],
    [""],
    ["1. Gõ học sinh vào 4 sheet Tổ 1, Tổ 2, Tổ 3, Tổ 4."],
    ["2. Dòng 1 là Tổ trưởng, dòng 2 là Tổ phó (hoặc ghi rõ ở cột Chức vụ tổ)."],
    ["3. Ngày sinh viết dd/mm/yyyy, ví dụ 12/03/2008."],
    ["4. Cột Chức vụ lớp dùng khi bổ nhiệm: Lớp trưởng, Lớp phó học tập, ..."],
    ["5. Lưu file rồi tải lên trang chủ nhiệm. Web nhận theo tên học sinh."],
  ]);
  XLSX.utils.book_append_sheet(workbook, guide, "Hướng dẫn");

  for (const teamNumber of [1, 2, 3, 4]) {
    const members = students
      .filter((student) => student.teamNumber === teamNumber)
      .sort((a, b) => {
        const rank = (role: TeamRole | null) => (role === "toTruong" ? 0 : role === "toPho" ? 1 : 2);
        return rank(a.teamRole) - rank(b.teamRole) || a.fullName.localeCompare(b.fullName, "vi");
      });
    const rows = members.length ? members.map(studentToTemplateRow) : emptyTemplateRows(teamNumber);
    const sheet = XLSX.utils.aoa_to_sheet([
      [...HEADERS],
      ...rows,
    ]);
    sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, sheet, `Tổ ${teamNumber}`);
  }

  const unassigned = students.filter((student) => !student.teamNumber);
  if (unassigned.length) {
    const sheet = XLSX.utils.aoa_to_sheet([
      [...HEADERS],
      ...unassigned.map((student, index) => studentToTemplateRow(student, index)),
    ]);
    sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Chưa gán");
  }

  return workbook;
}

export function buildClassExportWorkbook(rows: StudentExportRow[]) {
  const workbook = XLSX.utils.book_new();
  const body = rows.map((student, index) => [
    index + 1,
    student.fullName,
    formatBirthDate(student),
    student.teamNumber ? `Tổ ${student.teamNumber}` : "Chưa gán",
    studentPositionLabel(student),
    student.violationCount,
    student.absentDays,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([[...EXPORT_HEADERS], ...body]);
  sheet["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Danh sách lớp");
  return workbook;
}

export function workbookToBuffer(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseTeamWorkbook(buffer: Buffer): ImportedStudentRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const imported: ImportedStudentRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (/hướng dẫn|huong dan/i.test(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (!matrix.length) continue;
    const headers = matrix[0].map((cell) => String(cell ?? "").trim().toLowerCase());
    const nameIdx = headerIndex(headers, ["họ và tên", "ho va ten", "họ tên", "ten"]);
    const birthIdx = headerIndex(headers, ["ngày sinh", "ngay sinh", "ns"]);
    const teamRoleIdx = headerIndex(headers, ["chức vụ tổ", "chuc vu to", "vai trò tổ"]);
    const classDutyIdx = headerIndex(headers, ["chức vụ lớp", "chuc vu lop"]);
    const notesIdx = headerIndex(headers, ["ghi chú", "ghi chu"]);
    const teamColIdx = headerIndex(headers, ["tổ", "to ", "team"]);
    const sheetTeam = sheetTeamNumber(sheetName);
    const startRow = nameIdx >= 0 ? 1 : 0;

    let rowIndex = 0;
    for (const row of matrix.slice(startRow)) {
      const name = String(nameIdx >= 0 ? row[nameIdx] : row[1] ?? "").trim();
      if (!name || normalizePersonName(name) === "họ và tên") continue;
      rowIndex += 1;
      const teamFromCol = Number(String(teamColIdx >= 0 ? row[teamColIdx] : "").replace(/\D/g, ""));
      const teamNumber = sheetTeam ?? (teamFromCol >= 1 && teamFromCol <= 4 ? teamFromCol : 0);
      if (!teamNumber) continue;
      const birth = parseBirth(birthIdx >= 0 ? row[birthIdx] : row[2]);
      const roleRaw = String(teamRoleIdx >= 0 ? row[teamRoleIdx] : "");
      let teamRole = parseTeamRole(roleRaw);
      if (!roleRaw.trim()) {
        if (rowIndex === 1) teamRole = "toTruong";
        else if (rowIndex === 2) teamRole = "toPho";
        else teamRole = "thanhVien";
      }
      imported.push({
        fullName: name.replace(/\s+/g, " "),
        birthDay: birth.birthDay,
        birthMonth: birth.birthMonth,
        birthYear: birth.birthYear,
        teamNumber,
        teamRole,
        classDuty: parseClassDuty(String(classDutyIdx >= 0 ? row[classDutyIdx] : "")),
        notes: String(notesIdx >= 0 ? row[notesIdx] : "").trim(),
      });
    }
  }

  return imported;
}
