import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canReviewReports } from "@/lib/permissions";
import { computeRanking, computeTeamScore } from "@/lib/report-schema";
import { getSessionUser } from "@/lib/session";
import type { SchoolYear, WeeklyReport } from "@/lib/types";
import { buildExcelWeeks, EXCEL_WEEK_COUNT } from "@/lib/weeks";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const schoolYear = await db.collection<SchoolYear>("schoolYears").findOne(
      { isCurrent: true },
      { projection: { _id: 1 } },
    );
    if (!schoolYear?._id) {
      return NextResponse.json({ rows: [] });
    }

    const schoolYearId = String(schoolYear._id);
    const weeks = buildExcelWeeks();
    const reports = await db.collection<WeeklyReport>("weeklyReports")
      .find(
        { schoolYearId },
        {
          projection: {
            _id: 0,
            weekNumber: 1,
            reporterRole: 1,
            teamNumber: 1,
            "fields.team_score": 1,
            "fields.not_prepared_count": 1,
            "fields.no_homework_count": 1,
            "fields.disorder_count": 1,
            "fields.late_count": 1,
            "fields.violation_count": 1,
            "fields.absent_count": 1,
            "fields.good_points_count": 1,
            "fields.participation_count": 1,
          },
        },
      )
      .toArray();

    const submittedSet = new Set<string>();
    const ttByWeek = new Map<number, Array<{ teamNumber: number; fields: Record<string, string> }>>();

    for (const report of reports) {
      submittedSet.add(`${report.weekNumber}|${report.reporterRole}|${report.teamNumber ?? ""}`);
      if (report.reporterRole === "toTruong" && report.teamNumber != null) {
        const bucket = ttByWeek.get(report.weekNumber) ?? [];
        bucket.push({ teamNumber: report.teamNumber, fields: report.fields ?? {} });
        ttByWeek.set(report.weekNumber, bucket);
      }
    }

    const rankingByWeek = new Map<number, string>();
    for (const [weekNumber, teamReports] of ttByWeek) {
      const scores = teamReports.map((item) => ({
        teamNumber: item.teamNumber,
        score: Number(item.fields.team_score) || computeTeamScore(item.fields),
      }));
      rankingByWeek.set(weekNumber, computeRanking(scores).firstPlace);
    }

    const slots = [
      { role: "toTruong", team: 1 },
      { role: "toTruong", team: 2 },
      { role: "toTruong", team: 3 },
      { role: "toTruong", team: 4 },
      { role: "lopTruong", team: null },
      { role: "lopPhoHocTap", team: null },
      { role: "lopPhoTratTu", team: null },
      { role: "lopPhoLaoDong", team: null },
      { role: "lopPhoPhongTrao", team: null },
      { role: "thuQuy", team: null },
    ];

    const rows = [];
    for (let weekNumber = 1; weekNumber <= EXCEL_WEEK_COUNT; weekNumber += 1) {
      const cells: Record<string, boolean> = {};
      let submitted = 0;
      for (const slot of slots) {
        const ok = submittedSet.has(`${weekNumber}|${slot.role}|${slot.team ?? ""}`);
        cells[`${slot.role}|${slot.team ?? ""}`] = ok;
        if (ok) submitted += 1;
      }
      const week = weeks[weekNumber - 1];
      rows.push({
        weekNumber,
        label: week?.label ?? `Tuần ${weekNumber}`,
        dateRange: week?.dateRangeLabel ?? "",
        cells,
        firstPlace: rankingByWeek.get(weekNumber) ?? "",
        submitted,
        total: slots.length,
      });
    }

    return NextResponse.json({ rows }, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch {
    return NextResponse.json({ rows: [] }, { status: 500 });
  }
}
