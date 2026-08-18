import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { isClassOfficer } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import type { SchoolYear, WeeklyReport } from "@/lib/types";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isClassOfficer(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const schoolYear = await db.collection<SchoolYear>("schoolYears").findOne(
    { isCurrent: true },
    { projection: { _id: 1 } },
  );
  const schoolYearId = schoolYear?._id ? String(schoolYear._id) : "";
  const reports = schoolYearId
    ? await db
        .collection<WeeklyReport>("weeklyReports")
        .find(
          {
            schoolYearId,
            reporterRole: session.role,
            teamNumber: session.teamNumber ?? null,
          },
          { projection: { weekNumber: 1, weekLabel: 1, fields: 1, updatedAt: 1 } },
        )
        .sort({ weekNumber: -1, updatedAt: -1 })
        .limit(20)
        .toArray()
    : [];

  return NextResponse.json({
    schoolYearId,
    reports: reports.map((report) => ({
      _id: String(report._id),
      weekNumber: report.weekNumber,
      weekLabel: report.weekLabel,
      fields: report.fields ?? {},
      updatedAt: report.updatedAt,
    })),
  });
}
