import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  DEFAULT_DESK_COUNT,
  SEAT_TEAMS,
  seatColumn,
  seatFooterRow,
  seatRow,
  studentSeat,
} from "@/lib/syll-seats";
import { dutyTags, formatBirthDate } from "@/lib/team-roster";
import type { Student } from "@/lib/types";

/**
 * Sơ yếu lý lịch xuất theo đúng biểu mẫu nhà trường phát.
 *
 * Thay vì vẽ lại font/khung/thiết lập in bằng tay, module này mở file mẫu đã
 * làm rỗng ở src/assets/DuLieuLop-Mau.xlsx rồi ghi dữ liệu vào đúng ô. Nhờ vậy
 * file tải về giống hệt bản trường gửi — kể cả cỡ giấy, tỉ lệ in và dòng lặp
 * tiêu đề. Xem scripts/build-syll-template.mjs nếu trường đổi mẫu.
 */

const TEMPLATE_PATH = path.join(process.cwd(), "src", "assets", "DuLieuLop-Mau.xlsx");

/** Dòng dữ liệu đầu tiên của LyLich1 và LyLich2 (ngay dưới hai dòng tiêu đề gộp). */
const FIRST_DATA_ROW = 7;
/** Số dòng học sinh có sẵn trong file mẫu, theo từng sheet. */
const TEMPLATE_DATA_ROWS = { LyLich1: 47, LyLich2: 48 } as const;
/** Khối ký tên nằm dưới bảng: nhãn "GVCN" và tên thầy cô. */
const SIGN_LABEL_OFFSET = 3;
const SIGN_NAME_OFFSET = 9;
const SIGN_COLUMN = { LyLich1: 13, LyLich2: 12 } as const; // M và L
const LAST_COLUMN = { LyLich1: 18, LyLich2: 19 } as const;

/** Số bàn sẵn có trong sheet SoDoLop của file mẫu. */
const TEMPLATE_DESKS = DEFAULT_DESK_COUNT;

export type SyllClassInfo = {
  schoolName: string;
  className: string;
  yearName: string;
  gvcnName: string;
};

export type SyllRosterRow = { tt: number; fullName: string };

export type SyllStudent = Pick<
  Student,
  | "_id"
  | "fullName"
  | "birthDay"
  | "birthMonth"
  | "birthYear"
  | "birthPlace"
  | "gender"
  | "ethnicity"
  | "policy"
  | "addressGroup"
  | "addressWard"
  | "addressProvince"
  | "fatherName"
  | "fatherJob"
  | "motherName"
  | "motherJob"
  | "contactPhone"
  | "parentPhone"
  | "conduct"
  | "academic"
  | "classRole"
  | "email"
  | "idNumber"
  | "studentPhone"
  | "weight"
  | "height"
  | "canSwim"
  | "eyeDisease"
  | "medicalHistory"
  | "transport"
  | "onlineLearning"
  | "notes"
  | "profileTt"
  | "teamNumber"
  | "teamRole"
  | "classDuty"
  | "seatDesk"
  | "seatSide"
>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

/** Ô đánh dấu trong biểu mẫu chỉ nhận "x". */
function mark(on: unknown) {
  return on ? "x" : null;
}

function numberOrText(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : raw;
}

function isFemale(student: SyllStudent) {
  return /^n(ữ|u)$/i.test(text(student.gender));
}

/**
 * Cột "Biết bơi" chỉ đánh x cho em biết bơi. Form cũ dùng ô tick nên lưu "on",
 * form mới có thêm lựa chọn "Không" — chữ "Không" mà đánh x là sai hẳn nghĩa.
 */
function canSwim(student: SyllStudent) {
  const raw = text(student.canSwim);
  return Boolean(raw) && !/^(kh[ôo]ng|no)/i.test(raw);
}

/**
 * Biểu mẫu của trường để trống ô "Diện chính sách" cho em không thuộc diện nào,
 * còn form thì bắt chọn hẳn "Không" để không ai bỏ sót. Quy về đúng cách trường
 * ghi khi xuất ra.
 */
function policyCode(student: SyllStudent) {
  const raw = text(student.policy);
  return /^kh[ôo]ng$/i.test(raw) ? "" : raw;
}

function transportIs(student: SyllStudent, kind: "xd" | "xemay" | "khac") {
  const raw = text(student.transport).toLowerCase();
  if (!raw) return false;
  if (kind === "xd") return raw.includes("đạp") || raw.includes("dap") || raw === "xđ";
  if (kind === "xemay") return raw.includes("máy") || raw.includes("may") || raw.includes("điện");
  return raw.includes("khác") || raw.includes("khac");
}

function onlineIs(student: SyllStudent, kind: "du" | "khong" | "nho") {
  const raw = text(student.onlineLearning).toLowerCase();
  if (!raw) return false;
  if (kind === "nho") return raw.includes("nhờ") || raw.includes("nho ban") || raw.includes("nhobạn");
  if (kind === "khong") return raw.includes("không") || raw.includes("khong");
  return raw.includes("đủ") || raw.includes("du dk") || raw.includes("dđk");
}

/** "Nguyễn Thị Bích Huyền" → "Bích Huyền" — sơ đồ chỗ ngồi chỉ đủ chỗ cho tên gọi. */
function shortSeatName(fullName: string) {
  const parts = text(fullName).split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return parts.slice(-2).join(" ");
}

function seatCellText(student: SyllStudent) {
  // Cùng bảng viết tắt với sơ đồ trên web và cột "Ban cán sự lớp" của LyLich1.
  const tag = dutyTags(student).join(" + ");
  const name = shortSeatName(student.fullName);
  return tag ? `${name} \n(${tag})` : name;
}

/**
 * ExcelJS khai riêng `interface Buffer extends ArrayBuffer`, không khớp Buffer
 * của Node. Sao qua một ArrayBuffer thuần là hợp cả hai kiểu, chạy thì JSZip
 * nhận hết.
 */
function toArrayBuffer(data: Buffer | Uint8Array) {
  return new Uint8Array(data).buffer;
}

async function loadTemplate() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toArrayBuffer(await readFile(TEMPLATE_PATH)));
  return workbook;
}

/**
 * Kéo dài / rút ngắn vùng dữ liệu cho vừa sĩ số, giữ nguyên khung viền và
 * chiều cao dòng. Khối ký tên nằm dưới nên tự trôi theo.
 */
function setDataRows(sheet: ExcelJS.Worksheet, sheetName: keyof typeof TEMPLATE_DATA_ROWS, count: number) {
  const template = TEMPLATE_DATA_ROWS[sheetName];
  const lastCol = LAST_COLUMN[sheetName];
  if (count > template) {
    sheet.duplicateRow(FIRST_DATA_ROW + template - 1, count - template, true);
  } else if (count < template) {
    sheet.spliceRows(FIRST_DATA_ROW + count, template - count);
  }
  for (let index = 0; index < count; index += 1) {
    const row = sheet.getRow(FIRST_DATA_ROW + index);
    for (let col = 1; col <= lastCol; col += 1) row.getCell(col).value = null;
  }
}

function writeHeader(
  sheet: ExcelJS.Worksheet,
  info: SyllClassInfo,
  separator: string,
) {
  sheet.getCell("A1").value = info.schoolName;
  sheet.getCell("A2").value = `Lớp: ${info.className}${separator}Năm học ${info.yearName}`;
  sheet.getCell("A3").value = `GVCN: ${info.gvcnName}`;
}

function writeSignature(
  sheet: ExcelJS.Worksheet,
  sheetName: keyof typeof SIGN_COLUMN,
  lastDataRow: number,
  gvcnName: string,
) {
  const col = SIGN_COLUMN[sheetName];
  sheet.getRow(lastDataRow + SIGN_LABEL_OFFSET).getCell(col).value = "GVCN";
  sheet.getRow(lastDataRow + SIGN_NAME_OFFSET).getCell(col).value = gvcnName;
}

function fillLyLich1(sheet: ExcelJS.Worksheet, students: SyllStudent[], info: SyllClassInfo) {
  writeHeader(sheet, info, " ");
  setDataRows(sheet, "LyLich1", Math.max(students.length, 1));

  students.forEach((student, index) => {
    const row = sheet.getRow(FIRST_DATA_ROW + index);
    row.getCell(1).value = student.profileTt ?? index + 1;
    row.getCell(2).value = text(student.fullName) || null;
    row.getCell(3).value = formatBirthDate(student) || null;
    row.getCell(4).value = text(student.birthPlace) || null;
    row.getCell(5).value = mark(isFemale(student));
    row.getCell(6).value = text(student.ethnicity) || null;
    row.getCell(7).value = policyCode(student) || null;
    row.getCell(8).value = text(student.addressGroup) || null;
    row.getCell(9).value = text(student.addressWard) || null;
    row.getCell(10).value = text(student.addressProvince) || null;
    row.getCell(11).value = text(student.fatherName) || null;
    row.getCell(12).value = text(student.fatherJob) || null;
    row.getCell(13).value = text(student.motherName) || null;
    row.getCell(14).value = text(student.motherJob) || null;
    row.getCell(15).value = text(student.contactPhone) || text(student.parentPhone) || null;
    row.getCell(16).value = text(student.conduct) || null;
    row.getCell(17).value = text(student.academic) || null;
    // Cột "Ban cán sự lớp": lấy chức vụ GVCN bổ nhiệm. Chuỗi classRole là phần
    // học sinh từng tự khai ở bản cũ, chỉ dùng khi em chưa được bổ nhiệm lại.
    row.getCell(18).value = dutyTags(student).join(" + ") || text(student.classRole) || null;
  });

  writeSignature(sheet, "LyLich1", FIRST_DATA_ROW + Math.max(students.length, 1) - 1, info.gvcnName);
}

function fillLyLich2(sheet: ExcelJS.Worksheet, students: SyllStudent[], info: SyllClassInfo) {
  writeHeader(sheet, info, " ");
  setDataRows(sheet, "LyLich2", Math.max(students.length, 1));

  students.forEach((student, index) => {
    const row = sheet.getRow(FIRST_DATA_ROW + index);
    row.getCell(1).value = student.profileTt ?? index + 1;
    row.getCell(2).value = text(student.fullName) || null;
    row.getCell(3).value = formatBirthDate(student) || null;
    row.getCell(4).value = text(student.birthPlace) || null;
    row.getCell(5).value = text(student.email) || null;
    row.getCell(6).value = text(student.idNumber) || null;
    row.getCell(7).value = text(student.studentPhone) || null;
    row.getCell(8).value = numberOrText(student.weight);
    row.getCell(9).value = numberOrText(student.height);
    row.getCell(10).value = mark(canSwim(student));
    row.getCell(11).value = text(student.eyeDisease) || null;
    row.getCell(12).value = text(student.medicalHistory) || null;
    row.getCell(13).value = mark(transportIs(student, "xd"));
    row.getCell(14).value = mark(transportIs(student, "xemay"));
    row.getCell(15).value = mark(transportIs(student, "khac"));
    row.getCell(16).value = mark(onlineIs(student, "du"));
    row.getCell(17).value = mark(onlineIs(student, "khong"));
    row.getCell(18).value = mark(onlineIs(student, "nho"));
    row.getCell(19).value = text(student.notes) || policyCode(student) || null;
  });

  writeSignature(sheet, "LyLich2", FIRST_DATA_ROW + Math.max(students.length, 1) - 1, info.gvcnName);
}

/** Nhãn "Tổ 4 … Tổ 1" và dòng ghi chú dài phải được gộp lại sau khi dời dòng. */
function seatFooterMerges(labelRow: number) {
  return [
    `B${labelRow}:C${labelRow}`,
    `E${labelRow}:F${labelRow}`,
    `G${labelRow}:H${labelRow}`,
    `J${labelRow}:K${labelRow}`,
    `B${labelRow + 4}:K${labelRow + 4}`,
  ];
}

/**
 * Thêm / bớt bàn trong sơ đồ. ExcelJS không dời ô gộp khi chèn dòng nên phải
 * gỡ rồi gộp lại ở vị trí mới, nếu không nhãn "Tổ 4" sẽ nằm lệch khỏi ô gộp cũ.
 */
function setDeskCount(sheet: ExcelJS.Worksheet, deskCount: number) {
  if (deskCount === TEMPLATE_DESKS) return;

  for (const range of seatFooterMerges(seatFooterRow(TEMPLATE_DESKS))) sheet.unMergeCells(range);

  if (deskCount > TEMPLATE_DESKS) {
    // Chụp lại định dạng dòng có tên học sinh trước khi chèn, vì dòng nhân bản
    // là dòng trống (dòng đệm giữa hai bàn).
    const source = sheet.getRow(seatRow(TEMPLATE_DESKS));
    const deskHeight = source.height;
    const deskStyles = Array.from({ length: 11 }, (_, i) => ({ ...source.getCell(i + 1).style }));

    const extra = deskCount - TEMPLATE_DESKS;
    sheet.duplicateRow(seatRow(TEMPLATE_DESKS) - 1, extra * 2, true);
    for (let i = 0; i < extra; i += 1) {
      const row = sheet.getRow(seatRow(TEMPLATE_DESKS) + i * 2);
      row.height = deskHeight;
      deskStyles.forEach((style, col) => {
        row.getCell(col + 1).style = style;
        row.getCell(col + 1).value = null;
      });
    }
  } else {
    sheet.spliceRows(seatRow(deskCount) + 1, (TEMPLATE_DESKS - deskCount) * 2);
  }

  for (const range of seatFooterMerges(seatFooterRow(deskCount))) sheet.mergeCells(range);
}

function fillSoDoLop(
  sheet: ExcelJS.Worksheet,
  students: SyllStudent[],
  info: SyllClassInfo,
  deskCount: number,
) {
  writeHeader(sheet, info, " - ");
  setDeskCount(sheet, deskCount);

  const labelRow = seatFooterRow(deskCount);
  for (const team of SEAT_TEAMS) {
    sheet.getRow(labelRow).getCell(seatColumn(team, "trong")).value = `Tổ ${team}`;
  }

  for (const student of students) {
    const seat = studentSeat(student);
    if (!seat || seat.desk > deskCount) continue;
    const column = seatColumn(seat.team, seat.side);
    if (!column) continue;
    sheet.getRow(seatRow(seat.desk)).getCell(column).value = seatCellText(student);
  }
}

export type BuildSyllOptions = {
  students: SyllStudent[];
  info: SyllClassInfo;
  deskCount?: number;
  /** Số dòng để trống khi xuất mẫu nhập liệu (không truyền students). */
  blankRows?: number;
};

export async function buildSyllWorkbook({
  students,
  info,
  deskCount = DEFAULT_DESK_COUNT,
  blankRows,
}: BuildSyllOptions) {
  const workbook = await loadTemplate();
  const rows = students.length ? students : [];

  const lyLich1 = workbook.getWorksheet("LyLich1");
  const lyLich2 = workbook.getWorksheet("LyLich2");
  const soDoLop = workbook.getWorksheet("SoDoLop");
  if (!lyLich1 || !lyLich2 || !soDoLop) {
    throw new Error("File mẫu thiếu sheet LyLich1 / LyLich2 / SoDoLop.");
  }

  if (blankRows && !rows.length) {
    writeHeader(lyLich1, info, " ");
    writeHeader(lyLich2, info, " ");
    setDataRows(lyLich1, "LyLich1", blankRows);
    setDataRows(lyLich2, "LyLich2", blankRows);
    writeSignature(lyLich1, "LyLich1", FIRST_DATA_ROW + blankRows - 1, info.gvcnName);
    writeSignature(lyLich2, "LyLich2", FIRST_DATA_ROW + blankRows - 1, info.gvcnName);
  } else {
    fillLyLich1(lyLich1, rows, info);
    fillLyLich2(lyLich2, rows, info);
  }

  fillSoDoLop(soDoLop, rows, info, deskCount);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("result" in value) return String((value as { result?: unknown }).result ?? "").trim();
    if ("richText" in value) {
      return (value as { richText: Array<{ text: string }> }).richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value) return String((value as { text?: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}

/**
 * Đọc lại mẫu GVCN đã gõ số thứ tự + họ tên. Chỉ lấy hai cột đó — mọi thông tin
 * còn lại do học sinh tự điền qua form trên web.
 */
export async function parseSyllRoster(buffer: Buffer): Promise<SyllRosterRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toArrayBuffer(buffer));

  const sheet =
    workbook.worksheets.find((item) => /lylich\s*1/i.test(item.name)) ??
    workbook.worksheets.find((item) => !/huong\s*dan|hướng\s*dẫn|sodolop|sơ\s*đồ/i.test(item.name));
  if (!sheet) return [];

  // Bảng bắt đầu ngay dưới khối tiêu đề; dò để chịu được mẫu lệch dòng. Tiêu đề
  // "Họ và tên HS" gộp hai dòng nên phải chạy hết khối rồi mới tới dòng đầu
  // tiên — dừng ở dòng khớp cuối cùng thì mất luôn học sinh số 1.
  const isHeaderRow = (row: number) => /họ và tên/i.test(cellText(sheet.getRow(row).getCell(2)));
  let firstRow = FIRST_DATA_ROW;
  for (let row = 1; row <= Math.min(sheet.rowCount, 20); row += 1) {
    if (!isHeaderRow(row)) continue;
    let last = row;
    while (last < sheet.rowCount && isHeaderRow(last + 1)) last += 1;
    firstRow = last + 1;
    break;
  }

  // Mỗi dòng là một em, không gộp theo tên: lớp hoàn toàn có thể có hai em trùng
  // họ tên đầy đủ, gộp lại là mất luôn một em khỏi sổ.
  const rows: SyllRosterRow[] = [];
  for (let row = firstRow; row <= sheet.rowCount; row += 1) {
    const fullName = cellText(sheet.getRow(row).getCell(2)).replace(/\s+/g, " ");
    if (!fullName || /^họ và tên/i.test(fullName)) continue;
    const tt = Number(cellText(sheet.getRow(row).getCell(1)).replace(/\D/g, ""));
    rows.push({ tt: Number.isFinite(tt) && tt > 0 ? tt : rows.length + 1, fullName });
  }

  return rows;
}
