import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { CURRENT_CLASS_NAME, CURRENT_SCHOOL_YEAR } from "@/lib/academic-calendar";
import { getDb } from "@/lib/db";
import { parseStoredTimetable, parseTimetableWorkbook } from "@/lib/excel-timetable";
import { canManageStudents } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYear, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { archiveCurrentTimetable, versionMeta } from "@/lib/timetable-versions";
import type { ClassConfig } from "@/lib/types";

export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  const config = await resolveClassConfig(schoolYearId, {
    ...CLASS_CONFIG_FIELDS.timetable,
    updatedAt: 1,
  });
  return NextResponse.json({
    yearName: year?.name ?? "",
    isCurrent: Boolean(year?.isCurrent),
    updatedAt: config?.timetableUpdatedAt || (config?.timetableJson ? config.updatedAt : ""),
    versions: (config?.timetableHistory ?? []).map(versionMeta),
    teachers: parseStoredTimetable(config?.timetableJson)?.teachers ?? {},
  });
}

export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const year = await resolveSchoolYear(String(form.get("year") || "") || new URL(request.url).searchParams.get("year"));
  if (!year?._id) {
    return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  }
  if (!year.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem. Chỉ tải TKB cho năm hiện hành." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Chưa chọn file Excel thời khóa biểu." }, { status: 400 });
  }

  const grid = parseTimetableWorkbook(await file.arrayBuffer());
  const schoolYearId = String(year._id);
  const db = await getDb();
  const now = new Date().toISOString();
  const configs = db.collection<ClassConfig>("classConfigs");
  const existing = await configs.findOne({ schoolYearId });
  const timetableJson = JSON.stringify(grid);
  const timetableHistory = archiveCurrentTimetable(existing, { id: session.id, fullName: session.fullName });

  if (existing?._id) {
    await configs.updateOne(
      { _id: existing._id },
      { $set: { timetableJson, timetableUpdatedAt: now, timetableHistory, updatedAt: now } },
    );
  } else {
    await configs.insertOne({
      _id: new ObjectId().toHexString(),
      schoolYearId,
      className: CURRENT_CLASS_NAME,
      fullName: `Lớp ${CURRENT_CLASS_NAME} - ${year.name || CURRENT_SCHOOL_YEAR}`,
      gvcnName: "Võ Thanh Phong",
      gvcnDisplayName: "Thầy Võ Thanh Phong",
      gvcnPhone: "0382311919",
      gvcnZalo: "0382311919",
      timetableJson,
      timetableUpdatedAt: now,
      timetableHistory,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath("/");
  return NextResponse.json({
    ok: true,
    yearName: year.name,
    updatedAt: now,
    versions: timetableHistory.map(versionMeta),
    teachers: grid.teachers ?? {},
  });
}
