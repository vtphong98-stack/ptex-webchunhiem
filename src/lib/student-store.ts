import { getDb } from "@/lib/db";
import { parseMemberRows } from "@/lib/team-roster";
import type { SchoolYear, Student, WeeklyReport } from "@/lib/types";

export async function getCurrentSchoolYearDoc() {
  const db = await getDb();
  return db.collection<SchoolYear>("schoolYears").findOne(
    { isCurrent: true },
    { projection: { _id: 1, name: 1, label: 1 } },
  );
}

export async function studentStatsById(schoolYearId: string) {
  const db = await getDb();
  const reports = await db
    .collection<WeeklyReport>("weeklyReports")
    .find(
      { schoolYearId, reporterRole: "toTruong" },
      { projection: { fields: 1 } },
    )
    .toArray();

  const stats = new Map<string, { violationCount: number; absentDays: number }>();
  for (const report of reports) {
    for (const member of parseMemberRows(report.fields?.members_json)) {
      const key = member.studentId || member.fullName;
      const current = stats.get(key) ?? { violationCount: 0, absentDays: 0 };
      current.violationCount += member.violationCount;
      current.absentDays += member.absentCount;
      stats.set(key, current);
      if (member.studentId && member.fullName) {
        stats.set(member.fullName, current);
      }
    }
  }
  return stats;
}

export function attachStudentStats(
  students: Student[],
  stats: Map<string, { violationCount: number; absentDays: number }>,
) {
  return students.map((student) => {
    const byId = student._id ? stats.get(String(student._id)) : undefined;
    const byName = stats.get(student.fullName);
    return {
      ...student,
      violationCount: byId?.violationCount ?? byName?.violationCount ?? 0,
      absentDays: byId?.absentDays ?? byName?.absentDays ?? 0,
    };
  });
}
