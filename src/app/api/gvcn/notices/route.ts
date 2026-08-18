import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { formatNoticeDate, isNoticeNew, sortNotices } from "@/lib/notices";
import { canReviewReports } from "@/lib/permissions";
import { resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getSessionUser } from "@/lib/session";
import type { GvcnNotice } from "@/lib/types";

function serialize(notice: GvcnNotice, newestId: string) {
  return {
    _id: String(notice._id),
    title: notice.title,
    body: notice.body,
    pinned: Boolean(notice.pinned),
    isNew: isNoticeNew(notice.createdAt) || String(notice._id) === newestId,
    createdAt: notice.createdAt,
    dateLabel: formatNoticeDate(notice.createdAt),
    authorName: notice.createdByName || "",
  };
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  if (!schoolYearId) return NextResponse.json({ notices: [] });

  const db = await getDb();
  const notices = sortNotices(await db.collection<GvcnNotice>("notices").find({ schoolYearId }).toArray());
  const newest = [...notices].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const newestId = newest?._id ? String(newest._id) : "";

  return NextResponse.json({
    yearName: year?.name ?? "",
    isCurrent: Boolean(year?.isCurrent),
    notices: notices.map((notice) => serialize(notice, newestId)),
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) return NextResponse.json({ error: "Năm cũ chỉ xem. Chỉ đăng thông báo năm hiện hành." }, { status: 400 });

  const body = (await request.json()) as { title?: string; body?: string; pinned?: boolean };
    const title = String(body.title ?? "").trim();
    const content = String(body.body ?? "").trim();
  if (!title || !content) {
    return NextResponse.json({ error: "Cần tiêu đề và nội dung." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const notice: GvcnNotice = {
    _id: new ObjectId().toHexString(),
    schoolYearId: String(year._id),
    title,
    body: content,
    pinned: Boolean(body.pinned),
    createdAt: now,
    updatedAt: now,
    createdBy: session.id,
    createdByName: session.fullName,
  };
  const db = await getDb();
  await db.collection<GvcnNotice>("notices").insertOne(notice);
  await createAuditLog({
    schoolYearId: String(year._id),
    entityType: "notice",
    entityId: String(notice._id),
    action: "create",
    summary: `Đăng thông báo: ${title}`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ ok: true, notice: serialize(notice, String(notice._id)) });
}
