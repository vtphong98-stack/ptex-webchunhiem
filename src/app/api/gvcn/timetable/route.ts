import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { CURRENT_CLASS_NAME, CURRENT_SCHOOL_YEAR } from "@/lib/academic-calendar";
import { getDb } from "@/lib/db";
import { parseTimetableWorkbook } from "@/lib/excel-timetable";
import { canManageStudents } from "@/lib/permissions";
import { resolveClassConfig, resolveSchoolYear, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getSessionUser } from "@/lib/session";
import type { ClassConfig } from "@/lib/types";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  const config = schoolYearId ? await resolveClassConfig(schoolYearId) : null;
  return NextResponse.json({
    yearName: year?.name ?? "",
    isCurrent: Boolean(year?.isCurrent),
    timetableJson: config?.timetableJson ?? "",
  });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
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

  if (existing?._id) {
    await configs.updateOne({ _id: existing._id }, { $set: { timetableJson, updatedAt: now } });
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
      createdAt: now,
      updatedAt: now,
    });
  }

  return NextResponse.json({ ok: true, yearName: year.name });
}
