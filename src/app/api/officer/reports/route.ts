import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { isClassOfficer } from "@/lib/permissions";
import { enrichReportFields } from "@/lib/report-schema";
import { getSessionUser } from "@/lib/session";
import {
  emptyMemberRow,
  membersToReportFields,
  parseMemberRows,
  sortTeamStudents,
} from "@/lib/team-roster";
import type { SchoolYear, Student, WeeklyReport } from "@/lib/types";
import { getExcelWeek } from "@/lib/weeks";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !isClassOfficer(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 5, 1), 50);
  const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);

  const db = await getDb();
  const schoolYear = await db.collection<SchoolYear>("schoolYears").findOne(
    { isCurrent: true },
    { projection: { _id: 1 } },
  );
  const schoolYearId = schoolYear?._id ? String(schoolYear._id) : "";
  const reportFilter = {
    schoolYearId,
    reporterRole: session.role,
    teamNumber: session.teamNumber ?? null,
  };
  const reportRows = schoolYearId
    ? await db
        .collection<WeeklyReport>("weeklyReports")
        .find(reportFilter, { projection: { weekNumber: 1, weekLabel: 1, fields: 1, updatedAt: 1 } })
        .sort({ weekNumber: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .toArray()
    : [];
  const hasMore = reportRows.length > limit;
  const reports = (hasMore ? reportRows.slice(0, limit) : reportRows).map((report) => ({
    _id: String(report._id),
    weekNumber: report.weekNumber,
    weekLabel: report.weekLabel,
    fields: report.fields ?? {},
    updatedAt: report.updatedAt,
  }));

  const teamStudents =
    schoolYearId && session.role === "toTruong" && session.teamNumber
      ? sortTeamStudents(
          await db
            .collection<Student>("students")
            .find({ schoolYearId, teamNumber: session.teamNumber })
            .toArray(),
        )
      : [];

  return NextResponse.json({
    schoolYearId,
    hasMore,
    teamStudents: teamStudents.map((student) => ({
      _id: String(student._id),
      fullName: student.fullName,
      teamRole: student.teamRole ?? null,
    })),
    reports,
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isClassOfficer(session.role) || session.role !== "toTruong") {
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
  const schoolYear = await db.collection<SchoolYear>("schoolYears").findOne(
    { isCurrent: true },
    { projection: { _id: 1 } },
  );
  const schoolYearId = schoolYear?._id ? String(schoolYear._id) : "";
  if (!schoolYearId) {
    return NextResponse.json({ error: "Không có năm học hiện hành." }, { status: 400 });
  }

  const reports = db.collection<WeeklyReport>("weeklyReports");
  const existing = await reports.findOne({
    schoolYearId,
    weekNumber,
    reporterRole: session.role,
    teamNumber: session.teamNumber ?? null,
  });

  const roster = sortTeamStudents(
    await db
      .collection<Student>("students")
      .find({ schoolYearId, teamNumber: session.teamNumber ?? -1 })
      .toArray(),
  );
  const incoming = parseMemberRows(body.members);
  const fromRoster = roster.map(emptyMemberRow);
  const incomingById = new Map(incoming.map((row) => [row.studentId || row.fullName, row]));
  const aligned = fromRoster.map((row) => incomingById.get(row.studentId) ?? incomingById.get(row.fullName) ?? row);

  const week = getExcelWeek(weekNumber);
  const rawFields = {
    ...membersToReportFields(aligned),
    week_range: week?.dateRangeLabel ?? "",
  };
  const fields = enrichReportFields(session.role, rawFields);
  const now = new Date().toISOString();
  const payload = {
    weekNumber,
    weekLabel: week?.label ?? `Tuần ${weekNumber}`,
    reporterRole: session.role,
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

  if (existing?._id) {
    await reports.updateOne({ _id: existing._id }, { $set: payload });
    await createAuditLog({
      schoolYearId,
      entityType: "report",
      entityId: String(existing._id),
      action: "update",
      summary: `Cập nhật báo cáo ${payload.weekLabel} tổ ${session.teamNumber}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  } else {
    const createdAt = now;
    const newReport = {
      _id: crypto.randomUUID(),
      schoolYearId,
      ...payload,
      createdBy: session.id,
      createdAt,
    };
    await reports.insertOne(newReport);
    await createAuditLog({
      schoolYearId,
      entityType: "report",
      entityId: newReport._id,
      action: "create",
      summary: `Ghi mới báo cáo ${payload.weekLabel} tổ ${session.teamNumber}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  }

  return NextResponse.json({ ok: true, weekNumber });
}
