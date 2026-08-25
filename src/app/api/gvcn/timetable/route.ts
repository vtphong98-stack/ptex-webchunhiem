import { ObjectId } from "mongodb";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CURRENT_CLASS_NAME, CURRENT_SCHOOL_YEAR } from "@/lib/academic-calendar";
import { getDb } from "@/lib/db";
import {
  emptyTimetableGrid,
  parseStoredTimetable,
  parseTimetableWorkbook,
  sanitizeTimetableGrid,
  type TimetableGrid,
} from "@/lib/excel-timetable";
import { canManageStudents } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYear, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { archiveCurrentTimetable, versionMeta } from "@/lib/timetable-versions";
import type { ClassConfig, SessionUser } from "@/lib/types";

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
  const stored = parseStoredTimetable(config?.timetableJson);
  return NextResponse.json({
    yearName: year?.name ?? "",
    isCurrent: Boolean(year?.isCurrent),
    updatedAt: config?.timetableUpdatedAt || (config?.timetableJson ? config.updatedAt : ""),
    versions: (config?.timetableHistory ?? []).map(versionMeta),
    teachers: stored?.teachers ?? {},
    teacherPhones: stored?.teacherPhones ?? {},
    // Lưới đang dùng, để bảng gõ trực tiếp mở ra là sửa được ngay chứ không
    // phải gõ lại từ đầu.
    grid: stored ?? emptyTimetableGrid(),
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
  return saveTimetable(grid, String(year._id), year.name, session);
}

/**
 * Ghi một lưới TKB, dùng chung cho hai đường nhập: tải file Excel và gõ thẳng
 * trên web. Bản đang dùng được lưu lại thành phiên bản cũ trước khi ghi đè.
 */
async function saveTimetable(
  grid: TimetableGrid,
  schoolYearId: string,
  yearName: string,
  session: SessionUser,
) {
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
      fullName: `Lớp ${CURRENT_CLASS_NAME} - ${yearName || CURRENT_SCHOOL_YEAR}`,
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

  // Trang chủ đọc TKB qua unstable_cache; chỉ revalidatePath thì phải chờ hết
  // 60 giây mới thấy bản vừa tải lên.
  revalidateTag("timetable", "max");
  revalidateTag("public-site", "max");
  revalidatePath("/");
  return NextResponse.json({
    ok: true,
    yearName,
    updatedAt: now,
    versions: timetableHistory.map(versionMeta),
    teachers: grid.teachers ?? {},
    teacherPhones: grid.teacherPhones ?? {},
    grid,
  });
}

/** Gõ thẳng trên web: nhận lưới dạng JSON thay vì file Excel. */
export async function PUT(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { year?: string; grid?: unknown };
  const year = await resolveSchoolYear(body.year || new URL(request.url).searchParams.get("year"));
  if (!year?._id) {
    return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  }
  if (!year.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem. Chỉ sửa TKB của năm hiện hành." }, { status: 400 });
  }

  const grid = sanitizeTimetableGrid(body.grid);
  if (!grid) {
    return NextResponse.json({ error: "Bảng thời khóa biểu không hợp lệ." }, { status: 400 });
  }

  return saveTimetable(grid, String(year._id), year.name, session);
}
