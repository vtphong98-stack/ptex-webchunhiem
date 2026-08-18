import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { formatNoticeDate, isNoticeNew } from "@/lib/notices";
import { canReviewReports } from "@/lib/permissions";
import { resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getSessionUser } from "@/lib/session";
import type { GvcnNotice } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) return NextResponse.json({ error: "Năm cũ chỉ xem." }, { status: 400 });

  const { id } = await params;
  const payload = (await request.json()) as { title?: string; body?: string; pinned?: boolean };
  const db = await getDb();
  const notices = db.collection<GvcnNotice>("notices");
  const existing = await notices.findOne({ _id: id, schoolYearId: String(year._id) });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy thông báo." }, { status: 404 });

  const title = payload.title !== undefined ? String(payload.title).trim() : existing.title;
  const content = payload.body !== undefined ? String(payload.body).trim() : existing.body;
  if (!title || !content) {
    return NextResponse.json({ error: "Cần tiêu đề và nội dung." }, { status: 400 });
  }

  const next = {
    title,
    body: content,
    pinned: payload.pinned !== undefined ? Boolean(payload.pinned) : existing.pinned,
    updatedAt: new Date().toISOString(),
  };
  await notices.updateOne({ _id: id }, { $set: next });
  await createAuditLog({
    schoolYearId: String(year._id),
    entityType: "notice",
    entityId: id,
    action: "update",
    summary: `Sửa thông báo: ${title}`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({
    ok: true,
    notice: {
      ...existing,
      ...next,
      _id: id,
      isNew: isNoticeNew(existing.createdAt),
      dateLabel: formatNoticeDate(existing.createdAt),
    },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) return NextResponse.json({ error: "Năm cũ chỉ xem." }, { status: 400 });

  const { id } = await params;
  const db = await getDb();
  const existing = await db.collection<GvcnNotice>("notices").findOne({ _id: id, schoolYearId: String(year._id) });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy thông báo." }, { status: 404 });

  await db.collection<GvcnNotice>("notices").deleteOne({ _id: id });
  await createAuditLog({
    schoolYearId: String(year._id),
    entityType: "notice",
    entityId: id,
    action: "delete",
    summary: `Xóa thông báo: ${existing.title}`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ ok: true });
}
