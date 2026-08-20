import * as XLSX from "xlsx";

export type PlanRecord = { week: number; period: number; lesson: string; note: string };
export type TeachingPlanData = { lop11: PlanRecord[]; lop12: PlanRecord[] };

function parseNumberRange(str: string): number[] {
  if (!str?.trim()) return [];
  const nums: number[] = [];
  for (const part of str.split(/[,;\s]+/).map((s) => s.trim())) {
    if (!part) continue;
    if (part.includes("-")) {
      const [a, b] = part.split("-").map((s) => parseInt(s.trim()));
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = a; i <= b; i++) nums.push(i);
      }
    } else {
      const n = parseInt(part);
      if (!isNaN(n)) nums.push(n);
    }
  }
  return nums;
}

function parseSheetRecords(workbook: XLSX.WorkBook, names: string[]): PlanRecord[] {
  const sheetName = workbook.SheetNames.find((n) =>
    names.some((alias) => n.toLowerCase().includes(alias.toLowerCase())),
  );
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
    workbook.Sheets[sheetName],
    { header: 1, defval: "" },
  );
  if (rows.length < 2) return [];

  const records: PlanRecord[] = [];
  let lastWeek = "", lastPeriod = "";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const weekStr = String(row[0] ?? "").trim() || lastWeek;
    const periodStr = String(row[1] ?? "").trim() || lastPeriod;
    const lesson = String(row[2] ?? "").trim();
    const note = String(row[3] ?? "").trim();
    if (!weekStr && !periodStr && !lesson) continue;

    const ws = parseNumberRange(weekStr);
    const ps = parseNumberRange(periodStr);
    if (ws.length && ps.length && lesson) {
      for (const w of ws) {
        for (const p of ps) {
          records.push({ week: w, period: p, lesson, note });
        }
      }
    }
    if (String(row[0] ?? "").trim()) lastWeek = String(row[0]).trim();
    if (String(row[1] ?? "").trim()) lastPeriod = String(row[1]).trim();
  }
  return records;
}

export function parseTeachingPlanWorkbook(buffer: ArrayBuffer): TeachingPlanData {
  const workbook = XLSX.read(buffer, { type: "array" });
  return {
    lop11: parseSheetRecords(workbook, ["Lớp 11", "Lop 11", "11"]),
    lop12: parseSheetRecords(workbook, ["Lớp 12", "Lop 12", "12"]),
  };
}

export function buildTeachingPlanTemplate() {
  const workbook = XLSX.utils.book_new();

  const guide = [
    ["Hướng dẫn — Phân Phối Chương Trình / Lịch Báo Giảng"],
    ["1. Mỗi sheet là 1 lớp (Lớp 11, Lớp 12)."],
    ["2. Cột Tuần: số tuần (từ tuần 1 đến tuần 35)."],
    ["3. Cột Tiết: TIẾT TĂNG DẦN CẢ NĂM từ tiết 1 đến tiết 140."],
    ["   - Tuần 1: tiết 1, 2, 3, 4"],
    ["   - Tuần 2: tiết 5, 6, 7, 8"],
    ["   - ..."],
    ["   - Tuần 35: tiết 137, 138, 139, 140"],
    ["4. Cột Bài dạy: tên bài hoặc nội dung bài giảng."],
    ["5. Cột Ghi chú: tùy chọn (SGK trang, KNTT, kiểm tra, dạy bù...)."],
    ["6. Lưu file .xlsx rồi tải lên trang GVCN → tab Lịch dạy → Upload báo giảng."],
  ];

  const makeSheet = (label: string) => {
    const rows: (string | number)[][] = [
      [`Lịch Báo Giảng — ${label}`],
      ["Tuần", "Tiết", "Bài dạy", "Ghi chú"],
    ];
    for (let w = 1; w <= 35; w++) {
      for (let p = 1; p <= 4; p++) {
        const periodTotal = (w - 1) * 4 + p;
        rows.push([w, periodTotal, "", ""]);
      }
    }
    return rows;
  };

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), "Hướng dẫn");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makeSheet("Lớp 11")), "Lớp 11");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makeSheet("Lớp 12")), "Lớp 12");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
