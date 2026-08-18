import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canReviewReports } from "@/lib/permissions";
import { getReportFields } from "@/lib/report-fields";
import { assembleGvcnSummary, getTeamScoresForWeek } from "@/lib/report-schema";
import { getSessionUser } from "@/lib/session";
import type { SchoolYear, WeeklyReport } from "@/lib/types";
import { buildExcelWeeks } from "@/lib/weeks";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ weekNumber: string }> },
) {
  const session = await getSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { weekNumber: weekStr } = await params;
  const weekNumber = Number(weekStr);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const schoolYear = await db.collection<SchoolYear>("schoolYears").findOne(
      { isCurrent: true },
      { projection: { _id: 1 } },
    );

    if (!schoolYear?._id) {
      return NextResponse.json({ reports: [], summary: "", ranking: null, weekMeta: null });
    }

    const schoolYearId = String(schoolYear._id);
    const weeks = buildExcelWeeks();
    const weekMeta = weeks[weekNumber - 1] ?? null;

    const reports = await db.collection<WeeklyReport>("weeklyReports")
      .find(
        { schoolYearId, weekNumber },
        { projection: { reporterRole: 1, teamNumber: 1, updatedAt: 1, fields: 1, summary: 1 } },
      )
      .sort({ updatedAt: -1 })
      .toArray();

    const imported = reports.find((item) => item.reporterRole === "gvcn");
    const summary = imported?.fields?.summary || imported?.summary || assembleGvcnSummary({
      weekNumber,
      dateRangeLabel: weekMeta?.dateRangeLabel,
      reports,
    });

    return NextResponse.json({
      reports: reports.map((report) => ({
        _id: String(report._id),
        reporterRole: report.reporterRole,
        teamNumber: report.teamNumber,
        updatedAt: report.updatedAt,
        fields: report.fields ?? {},
        fieldDefs: getReportFields(report.reporterRole),
      })),
      summary,
      ranking: getTeamScoresForWeek(reports, weekNumber),
      weekMeta,
    });
  } catch {
    return NextResponse.json({ reports: [], summary: "", ranking: null, weekMeta: null }, { status: 500 });
  }
}
