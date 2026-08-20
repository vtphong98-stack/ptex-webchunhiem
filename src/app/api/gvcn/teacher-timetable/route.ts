import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { parseTeacherTimetableWorkbook } from "@/lib/excel-teacher-timetable";
import { canManageStudents } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYear, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { ClassConfig } from "@/lib/types";

export async function GET(request: Request) {
  // Only ever read from GVCN-gated screens, so the GET is gated too — this used
  // to hand the teacher's data to anonymous callers.
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  const config = await resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.teacherTimetable });
  const raw = (config as Record<string, unknown>)?.teacherTimetableJson as string | undefined;
  return NextResponse.json({
    data: raw ? JSON.parse(raw) : null,
    updatedAt: (config as Record<string, unknown>)?.teacherTimetableUpdatedAt || "",
  });
}

export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const year = await resolveSchoolYear(
    String(form.get("year") || "") || new URL(request.url).searchParams.get("year"),
  );
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) return NextResponse.json({ error: "Chỉ năm hiện hành." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Chưa chọn file Excel." }, { status: 400 });
  }

  const grid = parseTeacherTimetableWorkbook(await file.arrayBuffer());
  const schoolYearId = String(year._id);
  const db = await getDb();
  const now = new Date().toISOString();
  const configs = db.collection<ClassConfig>("classConfigs");

  await configs.updateOne(
    { schoolYearId },
    { $set: { teacherTimetableJson: JSON.stringify(grid), teacherTimetableUpdatedAt: now, updatedAt: now } },
  );

  revalidatePath("/");
  revalidatePath("/lich-day");
  return NextResponse.json({ ok: true, updatedAt: now });
}
