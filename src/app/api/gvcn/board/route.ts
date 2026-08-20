import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canReviewReports } from "@/lib/permissions";
import { computeRanking, computeTeamScore } from "@/lib/report-schema";
import {
  CLASS_CONFIG_FIELDS,
  listSchoolYears,
  resolveClassConfig,
  resolveSchoolYearFromRequest,
  weeksOfYear,
} from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { WeeklyReport } from "@/lib/types";

export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const schoolYear = await resolveSchoolYearFromRequest(request);
    if (!schoolYear?._id) {
      return NextResponse.json({ rows: [] });
    }

    const schoolYearId = String(schoolYear._id);
    const weeks = weeksOfYear(schoolYear);
    // Three independent reads. The class name is folded in here so the desk no
    // longer needs a separate /api/gvcn/class round trip after hydration.
    const [years, config, reports] = await Promise.all([
      listSchoolYears(),
      resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.identity }),
      db.collection<WeeklyReport>("weeklyReports")
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
      .toArray(),
    ]);

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
    const weekCount = weeks.length || 35;
    for (let weekNumber = 1; weekNumber <= weekCount; weekNumber += 1) {
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

    return NextResponse.json(
      {
        rows,
        yearName: schoolYear.name,
        className: config?.className ?? "",
        fullName: config?.fullName ?? "",
        isCurrent: Boolean(schoolYear.isCurrent),
        years: years.map((year) => ({ name: year.name, label: year.label, isCurrent: Boolean(year.isCurrent) })),
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch {
    return NextResponse.json({ rows: [] }, { status: 500 });
  }
}
