/**
 * Dựng src/assets/DuLieuLop-Mau.xlsx từ file mẫu của trường.
 *
 * Chỉ chạy tay khi trường đổi biểu mẫu:
 *   node scripts/build-syll-template.mjs "C:/duong/dan/DuLieuLop11C5.xlsx"
 *
 * Script giữ nguyên toàn bộ định dạng (font Times New Roman, khung viền, ô gộp,
 * thiết lập in) và chỉ xoá phần dữ liệu học sinh — nhờ vậy file web xuất ra
 * giống hệt mẫu nhà trường phát mà không phải vẽ lại style bằng tay.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "src", "assets", "DuLieuLop-Mau.xlsx");

const source = process.argv[2];
if (!source) {
  console.error("Thiếu đường dẫn file mẫu. Ví dụ: node scripts/build-syll-template.mjs ./DuLieuLop11C5.xlsx");
  process.exit(1);
}

/** Xoá giá trị nhưng giữ style của một vùng ô. */
function clearRange(sheet, firstRow, lastRow, lastCol) {
  for (let r = firstRow; r <= lastRow; r += 1) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= lastCol; c += 1) row.getCell(c).value = null;
    row.commit();
  }
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(source);

// Ba dòng tiêu đề đầu (tên trường, lớp/năm học, GVCN) do web ghi lại lúc xuất.
for (const [name, cols] of [["LyLich1", 18], ["LyLich2", 19], ["SoDoLop", 11]]) {
  const sheet = workbook.getWorksheet(name);
  sheet.getCell("A1").value = null;
  sheet.getCell("A2").value = null;
  sheet.getCell("A3").value = null;
  void cols;
}

// LyLich1: dữ liệu 7..53, ô ký tên GVCN ở M62 (M56 là nhãn "GVCN", giữ lại).
clearRange(workbook.getWorksheet("LyLich1"), 7, 53, 18);
workbook.getWorksheet("LyLich1").getCell("M62").value = null;

// LyLich2: dữ liệu 7..54, ô ký tên ở L63.
clearRange(workbook.getWorksheet("LyLich2"), 7, 54, 19);
workbook.getWorksheet("LyLich2").getCell("L63").value = null;

// SoDoLop: 6 bàn ở các dòng lẻ 7..17, hai chỗ mỗi tổ.
const seatSheet = workbook.getWorksheet("SoDoLop");
for (const row of [7, 9, 11, 13, 15, 17]) {
  for (const col of [2, 3, 5, 6, 7, 8, 10, 11]) seatSheet.getRow(row).getCell(col).value = null;
}

await workbook.xlsx.writeFile(OUT);
console.log("Đã ghi", OUT);
