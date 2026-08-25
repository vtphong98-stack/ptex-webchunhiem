import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import {
  DEFAULT_PENALTY,
  sanitizeDate,
  sanitizeName,
  sanitizePenalty,
  type AttendanceEvent,
} from "@/lib/attendance";
import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { Student } from "@/lib/types";

/**
 * Sổ điểm danh theo dịp của GVCN.
 *
 * Danh sách lớp trả kèm luôn để màn hình chỉ gọi một lượt là dựng được cả bảng
 * — sĩ số 42 em nên gộp vào rẻ hơn hai vòng gọi.
 */
export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) {
    return NextResponse.json({ students: [], events: [], isCurrent: false });
  }
  const schoolYearId = String(year._id);
  const db = await getDb();

  const raw = await db
    .collection<Student>("students")
    .find({ schoolYearId })
    .project({ fullName: 1, profileTt: 1, teamNumber: 1 })
    .sort({ profileTt: 1, fullName: 1 })
    .toArray();

  const events = await db
    .collection<AttendanceEvent>("attendanceEvents")
    .find({ schoolYearId })
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  return NextResponse.json(
    {
      isCurrent: Boolean(year.isCurrent),
      students: raw.map((student) => ({
        id: String(student._id),
        tt: student.profileTt ?? null,
        fullName: student.fullName,
        teamNumber: student.teamNumber ?? null,
      })),
      events: events.map((event) => ({ ...event, _id: String(event._id) })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) return NextResponse.json({ error: "Chưa có năm học." }, { status: 400 });
  if (!year.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem. Chỉ thêm dịp cho năm hiện hành." }, { status: 400 });
  }

  const body = (await request.json()) as { name?: unknown; date?: unknown; note?: unknown; penalty?: unknown };
  const name = sanitizeName(body.name);
  const date = sanitizeDate(body.date);
  if (!name) return NextResponse.json({ error: "Chưa đặt tên cho dịp điểm danh." }, { status: 400 });
  if (!date) return NextResponse.json({ error: "Ngày chưa hợp lệ." }, { status: 400 });

  const now = new Date().toISOString();
  const event: AttendanceEvent = {
    _id: new ObjectId().toHexString(),
    schoolYearId: String(year._id),
    name,
    date,
    note: sanitizeName(body.note),
    penalty: body.penalty === undefined ? DEFAULT_PENALTY : sanitizePenalty(body.penalty),
    closed: false,
    marks: {},
    excused: [],
    createdAt: now,
    updatedAt: now,
    createdBy: session.id,
    createdByName: session.fullName,
  };

  const db = await getDb();
  await db.collection<AttendanceEvent>("attendanceEvents").insertOne(event);
  await createAuditLog({
    schoolYearId: String(year._id),
    entityType: "attendance",
    entityId: event._id,
    action: "create",
    summary: `Thêm dịp điểm danh: ${name} (${date})`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ ok: true, event });
}
