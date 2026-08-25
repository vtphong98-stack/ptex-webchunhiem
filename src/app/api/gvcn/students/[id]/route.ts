import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { applyDutyChange, syncDutyAccounts } from "@/lib/duty-store";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import type { ClassDuty, Student, TeamRole } from "@/lib/types";

async function requireGvcn() {
  const session = await getVerifiedSessionUser();
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
  const student = await db.collection<Student>("students").findOne({ _id: id });
  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy học sinh." }, { status: 404 });
  }

  const result = await applyDutyChange(student, {
    teamNumber: body.teamNumber,
    teamRole: body.teamRole,
    classDuty: body.classDuty,
  });

  // Trang chủ hiện tên em đang giữ chức, danh bạ hiện chức vụ — cả hai đọc qua
  // unstable_cache nên phải xả tag, không thì phải chờ tới 60 giây mới thấy.
  revalidateTag("public-site", "max");
  revalidateTag("contacts", "max");

  void createAuditLog({
    schoolYearId: student.schoolYearId,
    entityType: "student",
    entityId: id,
    action: "update",
    summary: `Cập nhật tổ/chức vụ ${student.fullName}.`,
    actorId: auth.session.id,
    actorName: auth.session.fullName,
    actorRole: auth.session.role,
  });

  return NextResponse.json({ ok: true, ...result });
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
  // Em vừa xoá có thể đang giữ chức: trả tài khoản chức vụ về tên mặc định.
  await syncDutyAccounts(student.schoolYearId);
  revalidateTag("public-site", "max");
  revalidateTag("contacts", "max");

  void createAuditLog({
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
