import { NextResponse } from "next/server";

import { buildSyllWorkbook } from "@/lib/excel-syll";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import { loadSyllStudents, resolveSyllContext, syllFilename, xlsxResponseHeaders } from "@/lib/syll-store";

/** Sơ yếu lý lịch đầy đủ: LyLich1, LyLich2 và sơ đồ chỗ ngồi, đúng biểu mẫu. */
export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const context = await resolveSyllContext(new URL(request.url).searchParams.get("year"));
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }

  const students = await loadSyllStudents(context.schoolYearId);
  if (!students.length) {
    return NextResponse.json(
      { error: "Danh sách lớp đang trống. Tải mẫu, gõ họ tên rồi nhập lên trước." },
      { status: 400 },
    );
  }

  const buffer = await buildSyllWorkbook({
    students,
    info: context.info,
    deskCount: context.deskCount,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: xlsxResponseHeaders(syllFilename("DuLieuLop", context.info.className)),
  });
}
