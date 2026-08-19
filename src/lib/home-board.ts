import { getDb } from "@/lib/db";
import { parseMemberRows } from "@/lib/team-roster";
import { computeTeamScore } from "@/lib/report-schema";
import type { SchoolWeek, WeeklyReport } from "@/lib/types";
import { getWeekLockAt } from "@/lib/week-lock";
import { buildExcelWeeks, getExcelWeek } from "@/lib/weeks";

export type HomeTeamRank = {
  teamNumber: number;
  score: number;
  submitted: boolean;
  place: number;
};

export type HomeStarStudent = {
  fullName: string;
  teamNumber: number;
  goodPoints: number;
  participation: number;
  highlightScore: number;
  place: number;
};

export type HomeBoard = {
  weekNumber: number;
  weekLabel: string;
  dateRange: string;
  ended: boolean;
  firstPlace: string;
  teams: HomeTeamRank[];
  stars: HomeStarStudent[];
};

const TEAM_COUNT = 4;
const STAR_LIMIT = 8;

function lastCompletedWeek(weeks: SchoolWeek[], now: Date) {
  const done = weeks
    .map((week) => ({ week, lockAt: getWeekLockAt(week.weekNumber, weeks) }))
    .filter((item) => item.lockAt && item.lockAt.getTime() <= now.getTime())
    .map((item) => item.week.weekNumber);
  return done.length ? Math.max(...done) : 0;
}

function assignPlaces<T extends { score: number }>(rows: T[]): Array<T & { place: number }> {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return sorted.map((row, index) => {
    const place = index > 0 && row.score === sorted[index - 1].score ? 0 : index + 1;
    return { ...row, place };
  }).map((row, index, list) => {
    if (row.place) return row;
    const previous = list[index - 1];
    return { ...row, place: previous.place };
  });
}

function rankTeams(reports: WeeklyReport[]): HomeTeamRank[] {
  const byTeam = [1, 2, 3, 4].map((teamNumber) => {
    const report = reports.find((item) => item.teamNumber === teamNumber);
    return {
      teamNumber,
      score: report ? computeTeamScore(report.fields ?? {}) : 0,
      submitted: Boolean(report),
    };
  });
  const submitted = assignPlaces(byTeam.filter((item) => item.submitted));
  const placeOf = new Map(submitted.map((item) => [item.teamNumber, item.place]));
  return byTeam
    .map((item) => ({
      ...item,
      place: placeOf.get(item.teamNumber) ?? TEAM_COUNT + 1,
    }))
    .sort((a, b) => a.place - b.place || b.score - a.score || a.teamNumber - b.teamNumber);
}

function starStudents(reports: WeeklyReport[]): HomeStarStudent[] {
  const merged = new Map<string, HomeStarStudent>();
  for (const report of reports) {
    const teamNumber = report.teamNumber ?? 0;
    for (const member of parseMemberRows(report.fields?.members_json)) {
      if (member.goodPointsCount <= 0 && member.participationCount <= 0) continue;
      const key = member.studentId || member.fullName.trim().toLowerCase();
      const current = merged.get(key);
      const goodPoints = (current?.goodPoints ?? 0) + member.goodPointsCount;
      const participation = (current?.participation ?? 0) + member.participationCount;
      merged.set(key, {
        fullName: member.fullName || current?.fullName || "Học sinh",
        teamNumber: teamNumber || current?.teamNumber || 0,
        goodPoints,
        participation,
        highlightScore: goodPoints * 10 + participation,
        place: 0,
      });
    }
  }
  return assignPlaces([...merged.values()].map((item) => ({ ...item, score: item.highlightScore })))
    .slice(0, STAR_LIMIT)
    .map(({ score: _score, ...item }) => item);
}

export async function getHomeBoard(schoolYearId: string): Promise<HomeBoard> {
  const empty: HomeBoard = {
    weekNumber: 0,
    weekLabel: "",
    dateRange: "",
    ended: false,
    firstPlace: "",
    teams: [1, 2, 3, 4].map((teamNumber) => ({ teamNumber, score: 0, submitted: false, place: TEAM_COUNT + 1 })),
    stars: [],
  };
  if (!schoolYearId) return empty;

  const db = await getDb();
  const reports = db.collection<WeeklyReport>("weeklyReports");
  const weeks = buildExcelWeeks();
  const now = new Date();
  const completed = lastCompletedWeek(weeks, now);
  const latest = await reports.findOne(
    { schoolYearId, reporterRole: "toTruong" },
    { sort: { weekNumber: -1 }, projection: { weekNumber: 1 } },
  );
  const latestReported = latest?.weekNumber ?? 0;

  let weekNumber = completed;
  if (completed) {
    const count = await reports.countDocuments({ schoolYearId, reporterRole: "toTruong", weekNumber: completed });
    if (!count && latestReported && latestReported <= completed) weekNumber = latestReported;
    if (!count && !latestReported) weekNumber = completed;
  } else {
    weekNumber = latestReported;
  }

  if (!weekNumber) return empty;

  const teamReports = await reports
    .find(
      { schoolYearId, reporterRole: "toTruong", weekNumber },
      { projection: { weekNumber: 1, reporterRole: 1, teamNumber: 1, fields: 1 } },
    )
    .toArray();

  const teams = rankTeams(teamReports);
  const firstPlace = teams
    .filter((item) => item.submitted && item.place === 1)
    .map((item) => `Tổ ${item.teamNumber}`)
    .join(" · ");
  const week = getExcelWeek(weekNumber);
  const lockAt = getWeekLockAt(weekNumber, weeks);

  return {
    weekNumber,
    weekLabel: week?.label || `Tuần ${weekNumber}`,
    dateRange: week?.dateRangeLabel?.replace(/^từ ngày\s+/i, "").replace(/\s+đến\s+/i, " – ") || "",
    ended: Boolean(lockAt && lockAt.getTime() <= now.getTime()),
    firstPlace,
    teams,
    stars: starStudents(teamReports),
  };
}
