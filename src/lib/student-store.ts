import { getDb } from "@/lib/db";
import { semesterOfWeek } from "@/lib/academic-calendar";
import { parseMemberRows, sortTeamStudents, type TeamMemberWeekRow } from "@/lib/team-roster";
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

/** Only the keys a roster row renders — the full student doc is ~1 KB each. */
const ROSTER_PROJECTION = { fullName: 1, teamNumber: 1, teamRole: 1 } as const;

export async function getAllTeamRosters(schoolYearId: string) {
  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find({ schoolYearId }, { projection: ROSTER_PROJECTION })
    .toArray();
  const teams: Record<string, TeamRosterStudent[]> = {};
  for (const teamNumber of [1, 2, 3, 4]) {
    teams[String(teamNumber)] = toTeamRosterStudents(studentsInTeam(students, teamNumber));
  }
  return teams;
}

export async function getTeamRosterStudents(schoolYearId: string, teamNumber: number) {
  const db = await getDb();
  // Filter in Mongo, not in JS: this used to pull every student of the year.
  // $in keeps the old Number()-coercing tolerance for docs that stored the team
  // as a string.
  const students = await db
    .collection<Student>("students")
    .find(
      { schoolYearId, teamNumber: { $in: [teamNumber, String(teamNumber)] } as never },
      { projection: ROSTER_PROJECTION },
    )
    .toArray();
  return toTeamRosterStudents(sortTeamStudents(students));
}

export type SemesterTally = {
  violations: number;
  absences: number;
  lates: number;
  notPrepared: number;
  noHomework: number;
  disorder: number;
  goodPoints: number;
  participation: number;
};

export type StudentSemesterStats = {
  hk1: SemesterTally;
  hk2: SemesterTally;
  total: SemesterTally;
};

function emptyTally(): SemesterTally {
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

function addTally(target: SemesterTally, member: TeamMemberWeekRow) {
  target.violations += member.violationCount;
  target.absences += member.absentCount;
  target.lates += member.lateCount;
  target.notPrepared += member.notPreparedCount;
  target.noHomework += member.noHomeworkCount;
  target.disorder += member.disorderCount;
  target.goodPoints += member.goodPointsCount;
  target.participation += member.participationCount;
}

/**
 * Per-student tallies split by semester. The weekly reports are the only record
 * of discipline in the app, so this is what "thực tế" can be measured against.
 */
export async function studentSemesterStats(schoolYearId: string) {
  if (!schoolYearId) return new Map<string, StudentSemesterStats>();
  const db = await getDb();
  const reports = await db
    .collection<WeeklyReport>("weeklyReports")
    .find(
      { schoolYearId, reporterRole: "toTruong" },
      { projection: { weekNumber: 1, teamNumber: 1, "fields.members_json": 1 } },
    )
    .toArray();

  const stats = new Map<string, StudentSemesterStats>();
  for (const report of reports) {
    const semester = semesterOfWeek(report.weekNumber);
    for (const member of parseMemberRows(report.fields?.members_json)) {
      // Reports key members by id when the roster supplied one and by name
      // otherwise, so both keys point at the same record.
      const keys = [member.studentId, member.fullName?.trim()].filter(Boolean) as string[];
      if (!keys.length) continue;
      let entry = keys.map((key) => stats.get(key)).find(Boolean);
      if (!entry) {
        entry = { hk1: emptyTally(), hk2: emptyTally(), total: emptyTally() };
      }
      addTally(entry[semester], member);
      addTally(entry.total, member);
      for (const key of keys) stats.set(key, entry);
    }
  }
  return stats;
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
