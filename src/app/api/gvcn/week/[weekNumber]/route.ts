import { NextResponse } from "next/server";

import { buildGvcnWeekReport } from "@/lib/gvcn-report";
import { getDb } from "@/lib/db";
import { canReviewReports } from "@/lib/permissions";
import { getReportFields } from "@/lib/report-fields";
import { resolveSchoolYearFromRequest, weeksOfYear } from "@/lib/school-year-scope";
import { getSessionUser } from "@/lib/session";
import type { WeeklyReport } from "@/lib/types";

export async function GET(
  request: Request,
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
    const schoolYear = await resolveSchoolYearFromRequest(request);

    if (!schoolYear?._id) {
      return NextResponse.json({ reports: [], summary: "", report: null, ranking: null, weekMeta: null });
    }

    const schoolYearId = String(schoolYear._id);
    const weeks = weeksOfYear(schoolYear);
    const weekMeta = weeks[weekNumber - 1] ?? null;

    const reports = await db.collection<WeeklyReport>("weeklyReports")
      .find(
        { schoolYearId, weekNumber },
        { projection: { reporterRole: 1, teamNumber: 1, updatedAt: 1, fields: 1, summary: 1, weekNumber: 1 } },
      )
      .sort({ updatedAt: -1 })
      .toArray();

    const built = buildGvcnWeekReport({
      weekNumber,
      dateRangeLabel: weekMeta?.dateRangeLabel,
      reports,
    });

    const imported = reports.find((item) => item.reporterRole === "gvcn");
    const summary = imported?.fields?.summary || imported?.summary || built.text;

    return NextResponse.json(
      {
        reports: reports.map((report) => ({
          _id: String(report._id),
          reporterRole: report.reporterRole,
          teamNumber: report.teamNumber,
          updatedAt: report.updatedAt,
          fields: report.fields ?? {},
          fieldDefs: getReportFields(report.reporterRole),
        })),
        summary,
        report: built,
        ranking: built.ranking,
        weekMeta,
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch {
    return NextResponse.json({ reports: [], summary: "", report: null, ranking: null, weekMeta: null }, { status: 500 });
  }
}
