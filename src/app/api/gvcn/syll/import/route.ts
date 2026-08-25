import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { parseSyllRoster } from "@/lib/excel-syll";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import { resolveSyllContext } from "@/lib/syll-store";
import { normalizePersonName } from "@/lib/team-roster";
import type { Student } from "@/lib/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Nhận lại mẫu GVCN đã gõ số thứ tự + họ tên.
 *
 * File là bản gốc của danh sách lớp: thứ tự trong sổ gọi tên lấy từ cột TT.
 * Học sinh trùng tên được ghép lại (giữ nguyên hồ sơ các em đã điền), tên mới
 * thì tạo thêm. Em nào có trong web mà không có trong file thì chỉ báo lại cho
 * GVCN tự xoá — xoá ngầm sẽ mất luôn phần các em đã khai.
 */
export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const context = await resolveSyllContext(new URL(request.url).searchParams.get("year"));
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }
  if (!context.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem. Chuyển sang năm hiện hành để nhập." }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Chưa chọn file Excel." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File quá lớn (tối đa 5 MB)." }, { status: 400 });
  }

  let roster;
  try {
    roster = await parseSyllRoster(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "Không đọc được file. Hãy dùng đúng mẫu tải về (.xlsx)." }, { status: 400 });
  }
  if (!roster.length) {
    return NextResponse.json(
      { error: "Sheet LyLich1 chưa có họ tên nào. Gõ số thứ tự và họ tên rồi lưu lại file." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const students = db.collection<Student>("students");
  const existing = await students
    .find({ schoolYearId: context.schoolYearId }, { projection: { fullName: 1, profileTt: 1 } })
    .toArray();

  const unused = new Map<string, string[]>();
  for (const student of existing) {
    const key = normalizePersonName(student.fullName);
    const bucket = unused.get(key) ?? [];
    bucket.push(String(student._id));
    unused.set(key, bucket);
  }

  const now = new Date().toISOString();
  const matchedIds = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const [index, row] of roster.entries()) {
    const tt = row.tt || index + 1;
    const key = normalizePersonName(row.fullName);
    const bucket = unused.get(key);
    const matchId = bucket?.shift();

    if (matchId) {
      matchedIds.add(matchId);
      await students.updateOne(
        { _id: matchId },
        { $set: { fullName: row.fullName, profileTt: tt, updatedAt: now } },
      );
      updated += 1;
      continue;
    }

    await students.insertOne({
      _id: crypto.randomUUID(),
      schoolYearId: context.schoolYearId,
      fullName: row.fullName,
      birthDay: 0,
      birthMonth: 0,
      birthYear: null,
      teamNumber: null,
      teamRole: null,
      classDuty: null,
      position: null,
      parentPhone: "",
      parentName: "",
      profileTt: tt,
      notes: "",
      createdAt: now,
      updatedAt: now,
    } as Student);
    created += 1;
  }

  const missing = existing
    .filter((student) => !matchedIds.has(String(student._id)))
    .map((student) => ({ _id: String(student._id), fullName: student.fullName }));

  void createAuditLog({
    schoolYearId: context.schoolYearId,
    entityType: "student",
    entityId: context.schoolYearId,
    action: "import",
    summary: `Nhập danh sách sơ yếu lý lịch: thêm ${created}, cập nhật ${updated}.`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  revalidateTag("public-site", "max");
  revalidateTag("contacts", "max");

  return NextResponse.json({ ok: true, created, updated, total: roster.length, missing });
}
