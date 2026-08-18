import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import { attachStudentStats, getCurrentSchoolYearDoc, studentStatsById } from "@/lib/student-store";
import { sortTeamStudents, studentPositionLabel } from "@/lib/team-roster";
import type { Student } from "@/lib/types";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await getCurrentSchoolYearDoc();
  if (!schoolYear?._id) {
    return NextResponse.json({ schoolYearId: "", students: [] });
  }

  const schoolYearId = String(schoolYear._id);
  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find({ schoolYearId })
    .toArray();
  const stats = await studentStatsById(schoolYearId);

  return NextResponse.json({
    schoolYearId,
    students: attachStudentStats(sortTeamStudents(students), stats).map((student) => ({
      _id: String(student._id),
      fullName: student.fullName,
      birthDay: student.birthDay,
      birthMonth: student.birthMonth,
      birthYear: student.birthYear ?? null,
      teamNumber: student.teamNumber,
      teamRole: student.teamRole ?? null,
      classDuty: student.classDuty ?? null,
      position: studentPositionLabel(student),
      notes: student.notes ?? "",
      violationCount: student.violationCount,
      absentDays: student.absentDays,
    })),
  });
}
