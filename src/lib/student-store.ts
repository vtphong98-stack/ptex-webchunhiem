import { getDb } from "@/lib/db";
import { parseMemberRows, sortTeamStudents } from "@/lib/team-roster";
import type { SchoolYear, Student, TeamRole, WeeklyReport } from "@/lib/types";

export type TeamRosterStudent = {
  _id: string;
  fullName: string;
  teamRole: TeamRole | null;
};

export async function getCurrentSchoolYearDoc() {
  const db = await getDb();
  return db.collection<SchoolYear>("schoolYears").findOne(
    { isCurrent: true },
    { projection: { _id: 1, name: 1, label: 1 } },
  );
}

export function studentsInTeam(students: Student[], teamNumber: number) {
  return sortTeamStudents(students.filter((student) => Number(student.teamNumber) === teamNumber));
}

export function toTeamRosterStudents(students: Student[]): TeamRosterStudent[] {
  return students.map((student) => ({
    _id: String(student._id),
    fullName: student.fullName,
    teamRole: student.teamRole ?? null,
  }));
}

export async function getAllTeamRosters(schoolYearId: string) {
  const db = await getDb();
  const students = await db.collection<Student>("students").find({ schoolYearId }).toArray();
  const teams: Record<string, TeamRosterStudent[]> = {};
  for (const teamNumber of [1, 2, 3, 4]) {
    teams[String(teamNumber)] = toTeamRosterStudents(studentsInTeam(students, teamNumber));
  }
  return teams;
}

export async function getTeamRosterStudents(schoolYearId: string, teamNumber: number) {
  const db = await getDb();
  const students = await db.collection<Student>("students").find({ schoolYearId }).toArray();
  return toTeamRosterStudents(studentsInTeam(students, teamNumber));
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
