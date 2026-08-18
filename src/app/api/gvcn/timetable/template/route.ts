import { NextResponse } from "next/server";

import { CLASS_SITE } from "@/lib/class-site";
import { buildTimetableTemplate } from "@/lib/excel-timetable";
import { canManageStudents } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const buffer = buildTimetableTemplate();
  const filename = `Mau_TKB_${CLASS_SITE.className}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
