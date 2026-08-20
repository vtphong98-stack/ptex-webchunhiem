import { NextResponse } from "next/server";

import { buildGvcnWeekReport } from "@/lib/gvcn-report";
import { getDb } from "@/lib/db";
import { getReportFields } from "@/lib/report-fields";
import { resolveSchoolYear, weeksOfYear } from "@/lib/school-year-scope";
import type { WeeklyReport } from "@/lib/types";

/** Public read-only API — no auth required. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ weekNumber: string }> },
) {
  const { weekNumber: weekStr } = await params;
  const weekNumber = Number(weekStr);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const schoolYear = await resolveSchoolYear(undefined, { seed: false });

    if (!schoolYear?._id) {
      return NextResponse.json({ report: null, weekMeta: null });
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

    if (!reports.length) {
      return NextResponse.json({ report: null, weekMeta }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
      });
    }

    const built = buildGvcnWeekReport({
      weekNumber,
      dateRangeLabel: weekMeta?.dateRangeLabel,
      reports,
    });

    return NextResponse.json(
      {
        report: built,
        reports: reports.map((r) => ({
          _id: String(r._id),
          reporterRole: r.reporterRole,
          teamNumber: r.teamNumber,
          updatedAt: r.updatedAt,
          fields: r.fields ?? {},
          fieldDefs: getReportFields(r.reporterRole),
        })),
        weekMeta,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } },
    );
  } catch {
    return NextResponse.json({ report: null, weekMeta: null }, { status: 500 });
  }
}
