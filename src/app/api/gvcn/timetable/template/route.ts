import { NextResponse } from "next/server";

import { buildTimetableTemplate, parseStoredTimetable } from "@/lib/excel-timetable";
import { canManageStudents } from "@/lib/permissions";
import {
  CLASS_CONFIG_FIELDS,
  resolveClassConfig,
  resolveSchoolYearFromRequest,
} from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { syllFilename, xlsxResponseHeaders } from "@/lib/syll-store";

/**
 * Mẫu TKB đã điền sẵn thời khóa biểu và bảng phân công giáo viên đang dùng.
 * GVCN chỉ sửa chỗ đổi tiết hay đổi thầy cô, khỏi gõ lại cả bảng.
 */
export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  const config = await resolveClassConfig(schoolYearId, {
    ...CLASS_CONFIG_FIELDS.identity,
    ...CLASS_CONFIG_FIELDS.timetable,
  });

  const buffer = buildTimetableTemplate(parseStoredTimetable(config?.timetableJson));
  return new NextResponse(new Uint8Array(buffer), {
    headers: xlsxResponseHeaders(syllFilename("Mau_TKB_", config?.className ?? "")),
  });
}
