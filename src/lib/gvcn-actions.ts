"use server";

import { getDb } from "@/lib/db";
import { getReportFields } from "@/lib/report-fields";
import { assembleGvcnSummary, computeRanking, computeTeamScore, getTeamScoresForWeek } from "@/lib/report-schema";
import type { SchoolYear, WeeklyReport } from "@/lib/types";
import { buildExcelWeeks, EXCEL_WEEK_COUNT } from "@/lib/weeks";

export async function fetchBoardData(yearId: string) {
  const db = await getDb();

  const schoolYear = yearId
    ? await db.collection<SchoolYear>("schoolYears").findOne({ _id: yearId }, { projection: { _id: 1, weekCount: 1 } })
    : await db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true }, { projection: { _id: 1, weekCount: 1 } });

  if (!schoolYear?._id) {
    return { rows: [], weeksWithReports: [] };
  }

  const schoolYearId = String(schoolYear._id);
  const weekCount = EXCEL_WEEK_COUNT;
  const weeks = buildExcelWeeks();

  const reports = await db.collection<WeeklyReport>("weeklyReports")
    .find(
      { schoolYearId },
      { projection: { _id: 0, weekNumber: 1, reporterRole: 1, teamNumber: 1, fields: 1 } },
    )
    .toArray();

  const submittedSet = new Set<string>();
  const weeksSet = new Set<number>();
  const ttByWeek = new Map<number, Array<{ teamNumber: number; fields: Record<string, string> }>>();

  for (const r of reports) {
    submittedSet.add(`${r.weekNumber}|${r.reporterRole}|${r.teamNumber ?? ""}`);
    weeksSet.add(r.weekNumber);
    if (r.reporterRole === "toTruong" && r.teamNumber != null) {
      let arr = ttByWeek.get(r.weekNumber);
      if (!arr) { arr = []; ttByWeek.set(r.weekNumber, arr); }
      arr.push({ teamNumber: r.teamNumber, fields: r.fields ?? {} });
    }
  }

  const rankingByWeek = new Map<number, string>();
  for (const [wn, ttReports] of ttByWeek) {
    const scores = ttReports.map((r) => ({ teamNumber: r.teamNumber, score: computeTeamScore(r.fields) }));
    rankingByWeek.set(wn, computeRanking(scores).firstPlace);
  }

  const SLOTS = [
    { role: "toTruong", team: 1 }, { role: "toTruong", team: 2 },
    { role: "toTruong", team: 3 }, { role: "toTruong", team: 4 },
    { role: "lopTruong", team: null }, { role: "lopPhoHocTap", team: null },
    { role: "lopPhoTratTu", team: null }, { role: "lopPhoLaoDong", team: null },
    { role: "lopPhoPhongTrao", team: null }, { role: "thuQuy", team: null },
  ];

  const rows = [];
  for (let wn = 1; wn <= weekCount; wn++) {
    const cells: Record<string, boolean> = {};
    let submitted = 0;
    for (const s of SLOTS) {
      const ok = submittedSet.has(`${wn}|${s.role}|${s.team ?? ""}`);
      cells[`${s.role}|${s.team ?? ""}`] = ok;
      if (ok) submitted++;
    }
    const w = weeks[wn - 1];
    rows.push({
      weekNumber: wn,
      label: w?.label ?? `Tuần ${wn}`,
      dateRange: w?.dateRangeLabel ?? "",
      cells,
      firstPlace: rankingByWeek.get(wn) ?? "",
      submitted,
      total: SLOTS.length,
    });
  }

  return { rows, weeksWithReports: Array.from(weeksSet).sort((a, b) => a - b) };
}

export async function fetchWeekDetail(weekNumber: number, yearId: string) {
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return { reports: [], summary: "", ranking: null, weekMeta: null };
  }

  const db = await getDb();
  const schoolYear = yearId
    ? await db.collection<SchoolYear>("schoolYears").findOne({ _id: yearId }, { projection: { _id: 1 } })
    : await db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true }, { projection: { _id: 1 } });

  if (!schoolYear?._id) {
    return { reports: [], summary: "", ranking: null, weekMeta: null };
  }

  const schoolYearId = String(schoolYear._id);
  const weeks = buildExcelWeeks();
  const weekMeta = weeks[weekNumber - 1] ?? null;

  const reports = await db.collection<WeeklyReport>("weeklyReports")
    .find({ schoolYearId, weekNumber })
    .sort({ updatedAt: -1 })
    .toArray();

  const imported = reports.find((r) => r.reporterRole === "gvcn");
  const summary = imported?.fields?.summary || imported?.summary || assembleGvcnSummary({
    weekNumber,
    dateRangeLabel: weekMeta?.dateRangeLabel,
    reports,
  });

  const ranking = getTeamScoresForWeek(reports, weekNumber);

  const serialized = reports.map((r) => ({
    _id: String(r._id),
    reporterRole: r.reporterRole,
    teamNumber: r.teamNumber,
    updatedAt: r.updatedAt,
    fields: r.fields ?? {},
    fieldDefs: getReportFields(r.reporterRole),
  }));

  return { reports: serialized, summary, ranking, weekMeta };
}
