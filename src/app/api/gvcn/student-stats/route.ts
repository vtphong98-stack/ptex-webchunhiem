import { NextResponse } from "next/server";

import { isGvcnRole } from "@/lib/access";
import { getDb } from "@/lib/db";
import { resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { studentSemesterStats, type SemesterTally } from "@/lib/student-store";
import { sortTeamStudents } from "@/lib/team-roster";
import type { Student } from "@/lib/types";

function zero(): SemesterTally {
  return {
    violations: 0,
    absences: 0,
    lates: 0,
    notPrepared: 0,
    noHomework: 0,
    disorder: 0,
    goodPoints: 0,
    participation: 0,
  };
}

/** Per-student discipline tallies, split HK1 / HK2, for the whole class. */
export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !isGvcnRole(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  if (!schoolYearId) return NextResponse.json({ rows: [], yearName: "" });

  const db = await getDb();
  const [students, stats] = await Promise.all([
    db
      .collection<Student>("students")
      .find({ schoolYearId }, { projection: { fullName: 1, teamNumber: 1, teamRole: 1, classDuty: 1, position: 1 } })
      .toArray(),
    studentSemesterStats(schoolYearId),
  ]);

  const rows = sortTeamStudents(students).map((student) => {
    const entry = stats.get(String(student._id)) ?? stats.get(student.fullName);
    return {
      id: String(student._id),
      fullName: student.fullName,
      teamNumber: student.teamNumber ?? null,
      hk1: entry?.hk1 ?? zero(),
      hk2: entry?.hk2 ?? zero(),
      total: entry?.total ?? zero(),
    };
  });

  return NextResponse.json(
    { rows, yearName: year?.name ?? "" },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
