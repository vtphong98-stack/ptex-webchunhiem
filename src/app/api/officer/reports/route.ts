import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { TEAM_REPORT_ROLE, isClassOfficer, isTeamReporter } from "@/lib/permissions";
import { enrichReportFields } from "@/lib/report-schema";
import { getSessionUser } from "@/lib/session";
import { parseSignedVnd, previousRemainingFromChain } from "@/lib/treasury-duty";
import { getCurrentSchoolYearDoc, getTeamRosterStudents } from "@/lib/student-store";
import {
  emptyMemberRow,
  membersToReportFields,
  parseMemberRows,
} from "@/lib/team-roster";
import type { WeeklyReport } from "@/lib/types";
import { getExcelWeek } from "@/lib/weeks";
import { assertWeekWritable, getWeekLockStates } from "@/lib/week-lock-store";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !isClassOfficer(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 5, 1), 50);
  const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);
  const teamQuery = Number(searchParams.get("teamNumber"));
  const reuseTeam = Number(searchParams.get("reuseTeam"));
  const beforeWeek = Number(searchParams.get("beforeWeek"));

  const db = await getDb();
  const schoolYear = await getCurrentSchoolYearDoc();
  const schoolYearId = schoolYear?._id ? String(schoolYear._id) : "";

  if (schoolYearId && session.role === "lopPhoLaoDong" && reuseTeam >= 1 && reuseTeam <= 4 && beforeWeek > 1) {
    const reuseReport = await db.collection<WeeklyReport>("weeklyReports").findOne(
      {
        schoolYearId,
        reporterRole: "lopPhoLaoDong",
        teamNumber: null,
        weekNumber: { $lt: beforeWeek },
        "fields.duty_team": String(reuseTeam),
        "fields.labor_assignments_json": { $exists: true, $ne: "" },
      },
      {
        projection: { weekNumber: 1, weekLabel: 1, fields: 1 },
        sort: { weekNumber: -1 },
      },
    );
    return NextResponse.json({
      reuseReport: reuseReport
        ? {
            weekNumber: reuseReport.weekNumber,
            weekLabel: reuseReport.weekLabel,
            fields: reuseReport.fields ?? {},
          }
        : null,
    });
  }

  const reportFilter = {
    schoolYearId,
    reporterRole: isTeamReporter(session.role) ? TEAM_REPORT_ROLE : session.role,
    teamNumber: session.teamNumber ?? null,
  };

  const teamForRoster =
    isTeamReporter(session.role) && session.teamNumber
      ? session.teamNumber
      : session.role === "lopPhoLaoDong" && teamQuery >= 1 && teamQuery <= 4
        ? teamQuery
        : null;

  // These four reads are independent — running them sequentially cost one Atlas
  // round trip each (~45ms), so the officer desk waited ~215ms before painting.
  const [reportRows, teamStudents, treasuryChain, weekLocks] = await Promise.all([
    schoolYearId
      ? db
          .collection<WeeklyReport>("weeklyReports")
          .find(reportFilter, { projection: { weekNumber: 1, weekLabel: 1, fields: 1, updatedAt: 1 } })
          .sort({ weekNumber: -1, updatedAt: -1 })
          .skip(skip)
          .limit(limit + 1)
          .toArray()
      : Promise.resolve([]),
    schoolYearId && teamForRoster ? getTeamRosterStudents(schoolYearId, teamForRoster) : Promise.resolve([]),
    schoolYearId && session.role === "thuQuy"
      ? db
          .collection<WeeklyReport>("weeklyReports")
          .find(
            { schoolYearId, reporterRole: "thuQuy" },
            { projection: { weekNumber: 1, "fields.remaining": 1 } },
          )
          .sort({ weekNumber: 1 })
          .toArray()
      : Promise.resolve([]),
    schoolYearId ? getWeekLockStates(schoolYearId) : Promise.resolve([]),
  ]);

  const hasMore = reportRows.length > limit;
  const reports = (hasMore ? reportRows.slice(0, limit) : reportRows).map((report) => ({
    _id: String(report._id),
    weekNumber: report.weekNumber,
    weekLabel: report.weekLabel,
    fields: report.fields ?? {},
    updatedAt: report.updatedAt,
  }));

  const treasuryPreviousByWeek: Record<string, number> = {};
  if (schoolYearId && session.role === "thuQuy") {
    const remainings = treasuryChain.map((item) => ({
      weekNumber: item.weekNumber,
      remaining: parseSignedVnd(item.fields?.remaining),
    }));
    for (const item of remainings) {
      treasuryPreviousByWeek[String(item.weekNumber)] = previousRemainingFromChain(remainings, item.weekNumber);
    }
    const maxWeek = remainings.at(-1)?.weekNumber ?? 0;
    for (let week = 1; week <= Math.max(maxWeek + 1, 35); week += 1) {
      if (treasuryPreviousByWeek[String(week)] == null) {
        treasuryPreviousByWeek[String(week)] = previousRemainingFromChain(remainings, week);
      }
    }
  }

  return NextResponse.json({
    schoolYearId,
    hasMore,
    teamStudents,
    reports,
    treasuryPreviousByWeek,
    weekLocks,
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isClassOfficer(session.role) || !isTeamReporter(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    weekNumber?: number;
    members?: unknown;
  };
  const weekNumber = Number(body.weekNumber);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Thiếu tuần." }, { status: 400 });
  }

  const db = await getDb();
  const schoolYear = await getCurrentSchoolYearDoc();
  const schoolYearId = schoolYear?._id ? String(schoolYear._id) : "";
  if (!schoolYearId) {
    return NextResponse.json({ error: "Không có năm học hiện hành." }, { status: 400 });
  }

  const reports = db.collection<WeeklyReport>("weeklyReports");

  // The lock check, the existing row and the roster are independent lookups.
  const [lockedMessage, existing, roster] = await Promise.all([
    assertWeekWritable(schoolYearId, weekNumber),
    reports.findOne({
      schoolYearId,
      weekNumber,
      reporterRole: TEAM_REPORT_ROLE,
      teamNumber: session.teamNumber ?? null,
    }),
    session.teamNumber ? getTeamRosterStudents(schoolYearId, session.teamNumber) : Promise.resolve([]),
  ]);

  if (lockedMessage) {
    return NextResponse.json({ error: lockedMessage }, { status: 423 });
  }

  const incoming = parseMemberRows(body.members);
  const fromRoster = roster.map((student) => emptyMemberRow(student));
  const incomingById = new Map(incoming.map((row) => [row.studentId || row.fullName, row]));
  const aligned = fromRoster.map((row) => incomingById.get(row.studentId) ?? incomingById.get(row.fullName) ?? row);

  const week = getExcelWeek(weekNumber);
  const rawFields = {
    ...membersToReportFields(aligned),
    week_range: week?.dateRangeLabel ?? "",
  };
  const fields = enrichReportFields(TEAM_REPORT_ROLE, rawFields);
  const now = new Date().toISOString();
  const payload = {
    weekNumber,
    weekLabel: week?.label ?? `Tuần ${weekNumber}`,
    reporterRole: TEAM_REPORT_ROLE,
    reporterName: session.fullName,
    teamNumber: session.teamNumber ?? null,
    summary: fields.team_score ? `Điểm tổ: ${fields.team_score}` : "Đã nộp báo cáo tuần",
    studyNotes: fields.not_prepared_names || "",
    disciplineNotes: fields.absent_names || fields.late_names || "",
    activityNotes: "",
    financeNotes: "",
    futurePlan: "",
    fields,
    source: "form" as const,
    status: "submitted" as const,
    updatedBy: session.id,
    updatedAt: now,
  };

  // The audit row does not depend on the write result, so both go out together.
  if (existing?._id) {
    await Promise.all([
      reports.updateOne({ _id: existing._id }, { $set: payload }),
      createAuditLog({
        schoolYearId,
        entityType: "report",
        entityId: String(existing._id),
        action: "update",
        summary: `Cập nhật báo cáo ${payload.weekLabel} tổ ${session.teamNumber}.`,
        actorId: session.id,
        actorName: session.fullName,
        actorRole: session.role,
      }),
    ]);
  } else {
    const newReport = {
      _id: crypto.randomUUID(),
      schoolYearId,
      ...payload,
      createdBy: session.id,
      createdAt: now,
    };
    await Promise.all([
      reports.insertOne(newReport),
      createAuditLog({
        schoolYearId,
        entityType: "report",
        entityId: newReport._id,
        action: "create",
        summary: `Ghi mới báo cáo ${payload.weekLabel} tổ ${session.teamNumber}.`,
        actorId: session.id,
        actorName: session.fullName,
        actorRole: session.role,
      }),
    ]);
  }

  return NextResponse.json({ ok: true, weekNumber });
}
