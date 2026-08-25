import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import { isValidDeskCount, studentSeat } from "@/lib/syll-seats";
import { loadSyllStudents, resolveSyllContext } from "@/lib/syll-store";
import { dutyTags, studentPositionLabel } from "@/lib/team-roster";
import type { ClassConfig } from "@/lib/types";

export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = new URL(request.url).searchParams.get("year");
  const context = await resolveSyllContext(year);
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }

  const students = await loadSyllStudents(context.schoolYearId);
  return NextResponse.json(
    {
      yearName: context.yearName,
      isCurrent: context.isCurrent,
      deskCount: context.deskCount,
      syllPassword: context.syllPassword,
      syllLocked: context.syllLocked,
      schoolName: context.info.schoolName,
      className: context.info.className,
      gvcnName: context.info.gvcnName,
      students: students.map((student) => {
        const seat = studentSeat(student);
        return {
          _id: student._id,
          tt: student.profileTt ?? null,
          fullName: student.fullName,
          teamNumber: student.teamNumber ?? null,
          seatDesk: seat?.desk ?? null,
          seatSide: seat?.side ?? null,
          teamRole: student.teamRole ?? null,
          classDuty: student.classDuty ?? null,
          dutyTags: dutyTags(student),
          position: studentPositionLabel({
            teamNumber: student.teamNumber ?? null,
            teamRole: student.teamRole ?? null,
            classDuty: student.classDuty ?? null,
            position: null,
          }),
          submittedAt: student.syllSubmittedAt ?? "",
          // Số điện thoại liên lạc là cột GVCN cần nhất khi đi đòi hồ sơ còn thiếu.
          contactPhone: student.contactPhone || student.parentPhone || "",
        };
      }),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const context = await resolveSyllContext(url.searchParams.get("year"));
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }
  if (!context.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem." }, { status: 400 });
  }

  const body = (await request.json()) as {
    deskCount?: number;
    schoolName?: string;
    syllPassword?: string;
    syllLocked?: boolean;
  };
  const update: Partial<ClassConfig> = { updatedAt: new Date().toISOString() };

  if (body.deskCount !== undefined) {
    if (!isValidDeskCount(Number(body.deskCount))) {
      return NextResponse.json({ error: "Số bàn mỗi tổ phải từ 2 đến 8." }, { status: 400 });
    }
    update.seatDeskCount = Number(body.deskCount);
  }
  if (body.schoolName !== undefined) {
    update.schoolName = String(body.schoolName).trim();
  }
  if (body.syllPassword !== undefined) {
    const password = String(body.syllPassword).trim();
    if (password && password.length < 3) {
      return NextResponse.json({ error: "Mật khẩu cần ít nhất 3 ký tự." }, { status: 400 });
    }
    // Để trống nghĩa là quay về mặc định (tên lớp viết thường).
    update.syllPassword = password;
  }
  if (body.syllLocked !== undefined) {
    update.syllLocked = Boolean(body.syllLocked);
  }

  const db = await getDb();
  const configs = db.collection<ClassConfig>("classConfigs");
  const existing = await configs.findOne({ schoolYearId: context.schoolYearId }, { projection: { _id: 1 } });
  if (!existing?._id) {
    return NextResponse.json({ error: "Chưa có cấu hình lớp." }, { status: 400 });
  }
  await configs.updateOne({ _id: existing._id }, { $set: update });

  void createAuditLog({
    schoolYearId: context.schoolYearId,
    entityType: "classConfig",
    entityId: String(existing._id),
    action: "update",
    summary: "Cập nhật cấu hình sơ yếu lý lịch (số bàn / tên trường).",
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ ok: true, ...update });
}
