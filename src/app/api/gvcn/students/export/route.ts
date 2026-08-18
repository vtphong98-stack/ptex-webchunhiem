import { NextResponse } from "next/server";

import { CLASS_SITE } from "@/lib/class-site";
import { getDb } from "@/lib/db";
import { buildClassExportWorkbook, workbookToBuffer } from "@/lib/excel-teams";
import { canManageStudents } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import { attachStudentStats, getCurrentSchoolYearDoc, studentStatsById } from "@/lib/student-store";
import type { Student } from "@/lib/types";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await getCurrentSchoolYearDoc();
  if (!schoolYear?._id) {
    return NextResponse.json({ error: "Không có năm học hiện hành." }, { status: 400 });
  }

  const schoolYearId = String(schoolYear._id);
  const db = await getDb();
  const students = await db.collection<Student>("students").find({ schoolYearId }).sort({ fullName: 1 }).toArray();
  const stats = await studentStatsById(schoolYearId);
  const buffer = workbookToBuffer(buildClassExportWorkbook(attachStudentStats(students, stats)));
  const filename = `Danh_sach_lop_${CLASS_SITE.className}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
