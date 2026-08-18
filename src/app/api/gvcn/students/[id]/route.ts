import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import {
  CLASS_DUTY_USERNAME,
  studentPositionLabel,
  teamLeaderUsername,
} from "@/lib/team-roster";
import type { ClassDuty, Student, TeamRole } from "@/lib/types";

async function requireGvcn() {
  const session = await getSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return { session: null, error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireGvcn();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  const body = (await request.json()) as {
    teamNumber?: number | null;
    teamRole?: TeamRole | null;
    classDuty?: ClassDuty | null;
  };

  const db = await getDb();
  const students = db.collection<Student>("students");
  const student = await students.findOne({ _id: id });
  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy học sinh." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const nextTeam = body.teamNumber === undefined ? student.teamNumber : body.teamNumber;
  let nextRole = body.teamRole === undefined ? student.teamRole : body.teamRole;
  const nextDuty = body.classDuty === undefined ? student.classDuty : body.classDuty;

  if (body.teamNumber !== undefined && body.teamNumber !== student.teamNumber && body.teamRole === undefined) {
    nextRole = "thanhVien";
  }

  if (nextTeam && nextRole === "toTruong") {
    await students.updateMany(
      { schoolYearId: student.schoolYearId, teamNumber: nextTeam, teamRole: "toTruong", _id: { $ne: id } },
      { $set: { teamRole: "thanhVien", updatedAt: now } },
    );
  }
  if (nextTeam && nextRole === "toPho") {
    await students.updateMany(
      { schoolYearId: student.schoolYearId, teamNumber: nextTeam, teamRole: "toPho", _id: { $ne: id } },
      { $set: { teamRole: "thanhVien", updatedAt: now } },
    );
  }
  if (nextDuty) {
    await students.updateMany(
      { schoolYearId: student.schoolYearId, classDuty: nextDuty, _id: { $ne: id } },
      { $set: { classDuty: null, updatedAt: now } },
    );
    await db.collection("users").updateOne(
      { username: CLASS_DUTY_USERNAME[nextDuty] },
      { $set: { fullName: student.fullName, updatedAt: now } },
    );
  }
  if (nextRole === "toTruong" && nextTeam) {
    await db.collection("users").updateOne(
      { username: teamLeaderUsername(nextTeam) },
      { $set: { fullName: student.fullName, updatedAt: now } },
    );
  }

  const payload = {
    teamNumber: nextTeam,
    teamRole: nextRole,
    classDuty: nextDuty,
    position: studentPositionLabel({ teamRole: nextRole, classDuty: nextDuty, position: null }),
    updatedAt: now,
  };
  await students.updateOne({ _id: id }, { $set: payload });

  await createAuditLog({
    schoolYearId: student.schoolYearId,
    entityType: "student",
    entityId: id,
    action: "update",
    summary: `Cập nhật tổ/chức vụ ${student.fullName}.`,
    actorId: auth.session.id,
    actorName: auth.session.fullName,
    actorRole: auth.session.role,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireGvcn();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  const db = await getDb();
  const student = await db.collection<Student>("students").findOne({ _id: id });
  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy học sinh." }, { status: 404 });
  }

  await db.collection<Student>("students").deleteOne({ _id: id });
  await db.collection("parents").deleteMany({ studentId: id });

  await createAuditLog({
    schoolYearId: student.schoolYearId,
    entityType: "student",
    entityId: id,
    action: "delete",
    summary: `Xóa học sinh ${student.fullName} khỏi tổ.`,
    actorId: auth.session.id,
    actorName: auth.session.fullName,
    actorRole: auth.session.role,
  });

  return NextResponse.json({ ok: true });
}
