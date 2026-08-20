import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { canReviewReports } from "@/lib/permissions";
import { resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { EXCEL_WEEK_COUNT } from "@/lib/weeks";
import { findLock, type WeekLockOverride } from "@/lib/week-lock";
import { getWeekLockStates, type WeekLockDoc } from "@/lib/week-lock-store";

export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const schoolYear = await resolveSchoolYearFromRequest(request);
  const schoolYearId = schoolYear?._id ? String(schoolYear._id) : "";
  const locks = schoolYearId ? await getWeekLockStates(schoolYearId) : [];
  return NextResponse.json({ schoolYearId, yearName: schoolYear?.name ?? "", isCurrent: Boolean(schoolYear?.isCurrent), locks });
}

export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { weekNumber?: number; action?: "lock" | "unlock" | "auto" };
  const weekNumber = Number(body.weekNumber);
  if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > EXCEL_WEEK_COUNT) {
    return NextResponse.json({ error: "Tuần không hợp lệ." }, { status: 400 });
  }

  const schoolYear = await resolveSchoolYearFromRequest(request);
  const schoolYearId = schoolYear?._id ? String(schoolYear._id) : "";
  if (!schoolYearId) {
    return NextResponse.json({ error: "Không có năm học hiện hành." }, { status: 400 });
  }
  if (!schoolYear?.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem. Không đổi khóa tuần." }, { status: 400 });
  }

  const db = await getDb();
  const collection = db.collection<WeekLockDoc>("weekLocks");
  const now = new Date().toISOString();
  const filter = { schoolYearId, weekNumber };

  if (body.action === "auto") {
    await collection.deleteOne(filter);
  } else {
    const override: WeekLockOverride = body.action === "unlock" ? "open" : "locked";
    await collection.updateOne(
      filter,
      {
        $set: {
          schoolYearId,
          weekNumber,
          override,
          updatedBy: session.id,
          updatedByName: session.fullName,
          updatedAt: now,
        },
        $setOnInsert: { _id: crypto.randomUUID() },
      },
      { upsert: true },
    );
  }

  const actionLabel =
    body.action === "unlock" ? "Mở khóa" : body.action === "auto" ? "Trả về lịch tự động" : "Khóa";
  await createAuditLog({
    schoolYearId,
    entityType: "weekLock",
    entityId: `${schoolYearId}:${weekNumber}`,
    action: body.action === "unlock" ? "unlock" : body.action === "auto" ? "auto" : "lock",
    summary: `${actionLabel} báo cáo tuần ${weekNumber}.`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  const locks = await getWeekLockStates(schoolYearId);
  return NextResponse.json({ ok: true, lock: findLock(locks, weekNumber), locks });
}
