import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getReportFields } from "@/lib/report-fields";
import { assembleGvcnSummary, getTeamScoresForWeek } from "@/lib/report-schema";
import type { SchoolYear, WeeklyReport } from "@/lib/types";
import { buildExcelWeeks } from "@/lib/weeks";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ weekNumber: string }> },
) {
  const { weekNumber: weekStr } = await params;
  const weekNumber = Number(weekStr);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const yearId = searchParams.get("yearId");

  try {
    const db = await getDb();
    const schoolYear = yearId
      ? await db.collection<SchoolYear>("schoolYears").findOne({ _id: yearId }, { projection: { _id: 1 } })
      : await db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true }, { projection: { _id: 1 } });

    if (!schoolYear?._id) {
      return NextResponse.json({ reports: [], summary: "", ranking: null, weekMeta: null });
    }

    const schoolYearId = String(schoolYear._id);
    const weeks = buildExcelWeeks();
    const weekMeta = weeks[weekNumber - 1] ?? null;

    const reports = await db.collection<WeeklyReport>("weeklyReports")
      .find({ schoolYearId, weekNumber })
      .sort({ updatedAt: -1 })
      .toArray();

    // Compute summary
    const imported = reports.find((r) => r.reporterRole === "gvcn");
    const summary = imported?.fields?.summary || imported?.summary || assembleGvcnSummary({
      weekNumber,
      dateRangeLabel: weekMeta?.dateRangeLabel,
      reports,
    });

    const ranking = getTeamScoresForWeek(reports, weekNumber);

    // Serialize reports with labels
    const serialized = reports.map((r) => ({
      _id: r._id,
      reporterRole: r.reporterRole,
      teamNumber: r.teamNumber,
      updatedAt: r.updatedAt,
      fields: r.fields ?? {},
      fieldDefs: getReportFields(r.reporterRole),
    }));

    return NextResponse.json(
      { reports: serialized, summary, ranking, weekMeta },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } },
    );
  } catch {
    return NextResponse.json({ reports: [], summary: "", ranking: null, weekMeta: null }, { status: 500 });
  }
}
