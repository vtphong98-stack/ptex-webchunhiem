import { NextResponse } from "next/server";

import {
  countEvent,
  sanitizeExcused,
  sanitizeMarks,
  type AttendanceEvent,
} from "@/lib/attendance";
import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { Student } from "@/lib/types";

async function guard(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) {
    return { error: NextResponse.json({ error: "Chưa có năm học." }, { status: 400 }) };
  }
  if (!year.isCurrent) {
    return { error: NextResponse.json({ error: "Năm cũ chỉ xem, không sửa được." }, { status: 400 }) };
  }
  return { session, schoolYearId: String(year._id) };
}

/** Ghi bảng điểm danh của một dịp. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard(request);
  if (gate.error) return gate.error;
  const { schoolYearId } = gate;

  const { id } = await params;
  const db = await getDb();
  const events = db.collection<AttendanceEvent>("attendanceEvents");
  const event = await events.findOne({ _id: id, schoolYearId });
  if (!event) return NextResponse.json({ error: "Không tìm thấy dịp điểm danh." }, { status: 404 });
  if (event.closed) {
    return NextResponse.json({ error: "Dịp này đã chốt. Mở lại rồi mới sửa được." }, { status: 423 });
  }

  const roster = await db
    .collection<Student>("students")
    .find({ schoolYearId }, { projection: { _id: 1 } })
    .toArray();
  const validIds = new Set(roster.map((student) => String(student._id)));

  const body = (await request.json()) as { marks?: unknown; excused?: unknown };
  const marks = sanitizeMarks(body.marks, validIds);
  const excused = sanitizeExcused(body.excused, marks);
  const now = new Date().toISOString();

  await events.updateOne({ _id: id }, { $set: { marks, excused, updatedAt: now } });

  const tally = countEvent({ marks, excused });
  return NextResponse.json({ ok: true, updatedAt: now, marks, excused, tally });
}

/** Chốt sổ hoặc mở lại một dịp. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard(request);
  if (gate.error) return gate.error;
  const { session, schoolYearId } = gate;

  const { id } = await params;
  const body = (await request.json()) as { closed?: unknown };
  const closed = Boolean(body.closed);

  const db = await getDb();
  const events = db.collection<AttendanceEvent>("attendanceEvents");
  const event = await events.findOne({ _id: id, schoolYearId });
  if (!event) return NextResponse.json({ error: "Không tìm thấy dịp điểm danh." }, { status: 404 });

  await events.updateOne({ _id: id }, { $set: { closed, updatedAt: new Date().toISOString() } });
  await createAuditLog({
    schoolYearId,
    entityType: "attendance",
    entityId: id,
    action: "update",
    summary: `${closed ? "Chốt" : "Mở lại"} điểm danh: ${event.name}`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ ok: true, closed });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guard(request);
  if (gate.error) return gate.error;
  const { session, schoolYearId } = gate;

  const { id } = await params;
  const db = await getDb();
  const events = db.collection<AttendanceEvent>("attendanceEvents");
  const event = await events.findOne({ _id: id, schoolYearId });
  if (!event) return NextResponse.json({ error: "Không tìm thấy dịp điểm danh." }, { status: 404 });

  await events.deleteOne({ _id: id });
  await createAuditLog({
    schoolYearId,
    entityType: "attendance",
    entityId: id,
    action: "delete",
    summary: `Xóa dịp điểm danh: ${event.name} (${event.date})`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ ok: true });
}
