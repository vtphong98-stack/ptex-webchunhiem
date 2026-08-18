import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { computeRanking, computeTeamScore } from "@/lib/report-schema";
import type { SchoolYear, WeeklyReport } from "@/lib/types";
import { buildExcelWeeks, EXCEL_WEEK_COUNT } from "@/lib/weeks";

export const revalidate = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearId = searchParams.get("yearId");

  try {
    const db = await getDb();

    // Resolve school year
    const schoolYear = yearId
      ? await db.collection<SchoolYear>("schoolYears").findOne({ _id: yearId }, { projection: { _id: 1, weekCount: 1 } })
      : await db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true }, { projection: { _id: 1, weekCount: 1 } });

    if (!schoolYear?._id) {
      return NextResponse.json({ rows: [], weeksWithReports: [], weeks: [] }, { headers: cacheHeaders() });
    }

    const schoolYearId = String(schoolYear._id);
    const weekCount = EXCEL_WEEK_COUNT;
    const weeks = buildExcelWeeks();

    // Single lightweight query
    const reports = await db.collection<WeeklyReport>("weeklyReports")
      .find(
        { schoolYearId },
        { projection: { _id: 0, weekNumber: 1, reporterRole: 1, teamNumber: 1, fields: 1 } },
      )
      .toArray();

    // Pre-compute everything in one pass
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

    // Pre-compute rankings
    const rankingByWeek = new Map<number, string>();
    for (const [wn, ttReports] of ttByWeek) {
      const scores = ttReports.map((r) => ({ teamNumber: r.teamNumber, score: computeTeamScore(r.fields) }));
      rankingByWeek.set(wn, computeRanking(scores).firstPlace);
    }

    // Build rows
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

    return NextResponse.json(
      { rows, weeksWithReports: Array.from(weeksSet).sort((a, b) => a - b) },
      { headers: cacheHeaders() },
    );
  } catch {
    return NextResponse.json({ rows: [], weeksWithReports: [] }, { status: 500 });
  }
}

function cacheHeaders() {
  return { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" };
}
