import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { versionMeta } from "@/lib/timetable-versions";
import type { ClassConfig } from "@/lib/types";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) return NextResponse.json({ error: "Năm cũ chỉ xem. Không xóa TKB năm cũ." }, { status: 400 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Thiếu phiên bản." }, { status: 400 });

  const schoolYearId = String(year._id);
  const db = await getDb();
  const configs = db.collection<ClassConfig>("classConfigs");
  const existing = await resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.timetable });
  if (!existing?._id) return NextResponse.json({ error: "Chưa có cấu hình lớp." }, { status: 400 });

  const history = existing.timetableHistory ?? [];
  if (!history.some((item) => item.id === id)) {
    return NextResponse.json({ error: "Không tìm thấy phiên bản cũ." }, { status: 404 });
  }

  const nextHistory = history.filter((item) => item.id !== id);
  await configs.updateOne(
    { _id: existing._id },
    { $set: { timetableHistory: nextHistory, updatedAt: new Date().toISOString() } },
  );
  // Trang chủ đọc TKB qua unstable_cache; chỉ revalidatePath thì phải chờ hết
  // 60 giây mới thấy bản vừa tải lên.
  revalidateTag("timetable", "max");
  revalidateTag("public-site", "max");
  revalidatePath("/");
  return NextResponse.json({ ok: true, versions: nextHistory.map(versionMeta) });
}
