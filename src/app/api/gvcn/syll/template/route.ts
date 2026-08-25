import { NextResponse } from "next/server";

import { buildSyllWorkbook } from "@/lib/excel-syll";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import { resolveSyllContext, syllFilename, xlsxResponseHeaders } from "@/lib/syll-store";

const DEFAULT_BLANK_ROWS = 50;
const MAX_BLANK_ROWS = 60;

/**
 * Mẫu rỗng để GVCN gõ số thứ tự + họ tên rồi tải ngược lên.
 *
 * Đúng biểu mẫu nhà trường phát, chỉ khác là không có dữ liệu — mọi thông tin
 * còn lại do chính học sinh điền qua form trên web.
 */
export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const context = await resolveSyllContext(url.searchParams.get("year"));
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }

  const requested = Number(url.searchParams.get("rows"));
  const rows = Number.isInteger(requested) && requested >= 1 && requested <= MAX_BLANK_ROWS
    ? requested
    : DEFAULT_BLANK_ROWS;

  const buffer = await buildSyllWorkbook({
    students: [],
    info: context.info,
    deskCount: context.deskCount,
    blankRows: rows,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: xlsxResponseHeaders(syllFilename("Mau_DuLieuLop", context.info.className)),
  });
}
