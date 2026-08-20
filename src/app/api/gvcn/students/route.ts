import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { attachStudentStats, studentStatsById } from "@/lib/student-store";
import { sortTeamStudents, studentPositionLabel } from "@/lib/team-roster";
import type { Student } from "@/lib/types";

export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const lite = url.searchParams.get("lite") === "1";
  const profile = url.searchParams.get("profile") === "1";
  const schoolYear = await resolveSchoolYearFromRequest(request);
  if (!schoolYear?._id) {
    return NextResponse.json({ schoolYearId: "", yearName: "", isCurrent: false, students: [] });
  }

  const schoolYearId = String(schoolYear._id);
  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find({ schoolYearId })
    .toArray();
  const stats = lite || profile ? new Map<string, { violationCount: number; absentDays: number }>() : await studentStatsById(schoolYearId);

  return NextResponse.json(
    {
      schoolYearId,
      yearName: schoolYear.name,
      isCurrent: Boolean(schoolYear.isCurrent),
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
        ...(profile
          ? {
              parentPhone: student.parentPhone ?? "",
              parentName: student.parentName ?? "",
              studentPhone: student.studentPhone ?? "",
              contactPhone: student.contactPhone ?? "",
              email: student.email ?? "",
              idNumber: student.idNumber ?? "",
              birthPlace: student.birthPlace ?? "",
              gender: student.gender ?? "",
              ethnicity: student.ethnicity ?? "",
              addressGroup: student.addressGroup ?? "",
              addressWard: student.addressWard ?? "",
              addressProvince: student.addressProvince ?? "",
              fatherName: student.fatherName ?? "",
              fatherJob: student.fatherJob ?? "",
              motherName: student.motherName ?? "",
              motherJob: student.motherJob ?? "",
              classRole: student.classRole ?? "",
            }
          : {}),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
