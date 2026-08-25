import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { versionMeta } from "@/lib/timetable-versions";
import type { ClassConfig } from "@/lib/types";

const TEACHER_FIELDS = {
  ...CLASS_CONFIG_FIELDS.teacherTimetable,
  teacherTimetableHistory: 1,
} as const;

/** Mở lại một bản lịch dạy cũ, hoặc xoá hẳn nó khỏi danh sách. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  const config = (await resolveClassConfig(schoolYearId, { ...TEACHER_FIELDS })) as ClassConfig | null;
  const { id } = await params;
  const version = (config?.teacherTimetableHistory ?? []).find((item) => item.id === id);
  if (!version) return NextResponse.json({ error: "Không tìm thấy phiên bản cũ." }, { status: 404 });

  try {
    return NextResponse.json({ data: JSON.parse(version.timetableJson), createdAt: version.createdAt });
  } catch {
    return NextResponse.json({ error: "Phiên bản cũ bị hỏng dữ liệu." }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem. Không xóa lịch dạy năm cũ." }, { status: 400 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Thiếu phiên bản." }, { status: 400 });

  const schoolYearId = String(year._id);
  const db = await getDb();
  const configs = db.collection<ClassConfig>("classConfigs");
  const existing = (await resolveClassConfig(schoolYearId, { ...TEACHER_FIELDS })) as ClassConfig | null;
  if (!existing?._id) return NextResponse.json({ error: "Chưa có cấu hình lớp." }, { status: 400 });

  const history = existing.teacherTimetableHistory ?? [];
  if (!history.some((item) => item.id === id)) {
    return NextResponse.json({ error: "Không tìm thấy phiên bản cũ." }, { status: 404 });
  }

  const nextHistory = history.filter((item) => item.id !== id);
  await configs.updateOne(
    { _id: existing._id },
    { $set: { teacherTimetableHistory: nextHistory, updatedAt: new Date().toISOString() } },
  );
  revalidatePath("/lich-day");
  return NextResponse.json({ ok: true, versions: nextHistory.map(versionMeta) });
}
