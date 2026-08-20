import { NextResponse } from "next/server";

import { CLASS_SITE } from "@/lib/class-site";
import { getDb } from "@/lib/db";
import { buildTeamTemplateWorkbook, workbookToBuffer } from "@/lib/excel-teams";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import { getCurrentSchoolYearDoc } from "@/lib/student-store";
import type { Student } from "@/lib/types";

export async function GET() {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await getCurrentSchoolYearDoc();
  const db = await getDb();
  const students = schoolYear?._id
    ? await db.collection<Student>("students").find({ schoolYearId: String(schoolYear._id) }).toArray()
    : [];
  const buffer = workbookToBuffer(buildTeamTemplateWorkbook(students));
  const filename = `Mau_chia_to_${CLASS_SITE.className}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
