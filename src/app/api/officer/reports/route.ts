import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { isClassOfficer } from "@/lib/permissions";
import { enrichReportFields } from "@/lib/report-schema";
import { getSessionUser } from "@/lib/session";
import {
  emptyMemberRow,
  membersToReportFields,
  mergeMemberRows,
  parseMemberRows,
  sortTeamStudents,
} from "@/lib/team-roster";
import type { ReportWriteMode, SchoolYear, Student, WeeklyReport } from "@/lib/types";
import { getExcelWeek } from "@/lib/weeks";

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
    teamStudents: teamStudents.map((student) => ({
      _id: String(student._id),
      fullName: student.fullName,
      teamRole: student.teamRole ?? null,
    })),
    reports: reports.map((report) => ({
      _id: String(report._id),
      weekNumber: report.weekNumber,
      weekLabel: report.weekLabel,
      fields: report.fields ?? {},
      updatedAt: report.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !isClassOfficer(session.role) || session.role !== "toTruong") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    weekNumber?: number;
    writeMode?: ReportWriteMode;
    members?: unknown;
  };
  const writeMode = body.writeMode;
  const weekNumber = Number(body.weekNumber);
  if (!writeMode || !["create", "append", "edit"].includes(writeMode)) {
    return NextResponse.json({ error: "Chọn Ghi mới, Bổ sung hoặc Sửa trước khi gửi." }, { status: 400 });
  }
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

  if (writeMode === "create" && existing?._id) {
    return NextResponse.json(
      { error: "Tuần này đã có dữ liệu. Chọn Bổ sung để cộng dồn, hoặc Sửa để thay toàn bộ." },
      { status: 409 },
    );
  }

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

  let members = aligned;
  if (writeMode === "append" && existing?.fields) {
    members = mergeMemberRows(parseMemberRows(existing.fields.members_json), aligned);
  }

  const week = getExcelWeek(weekNumber);
  const rawFields = {
    ...membersToReportFields(members),
    write_mode: writeMode,
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
      action: writeMode,
      summary: `${writeMode === "append" ? "Bổ sung" : "Sửa"} báo cáo ${payload.weekLabel} tổ ${session.teamNumber}.`,
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

  return NextResponse.json({ ok: true, writeMode, weekNumber });
}
