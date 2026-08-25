import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  parseStoredTeacherTimetable,
  parseTeacherTimetableWorkbook,
  sanitizeTeacherTimetableGrid,
  type TeacherTimetableGrid,
} from "@/lib/excel-teacher-timetable";
import { canManageStudents } from "@/lib/permissions";
import {
  CLASS_CONFIG_FIELDS,
  resolveClassConfig,
  resolveSchoolYear,
  resolveSchoolYearFromRequest,
} from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import { archiveCurrentTeacherTimetable, versionMeta } from "@/lib/timetable-versions";
import type { ClassConfig, SessionUser } from "@/lib/types";

/** Cột lịch sử phiên bản chỉ đọc ở màn hình GVCN nên không nằm trong bộ mặc định. */
const TEACHER_FIELDS = {
  ...CLASS_CONFIG_FIELDS.teacherTimetable,
  teacherTimetableHistory: 1,
  updatedAt: 1,
} as const;

export async function GET(request: Request) {
  // Only ever read from GVCN-gated screens, so the GET is gated too — this used
  // to hand the teacher's data to anonymous callers.
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  const config = (await resolveClassConfig(schoolYearId, { ...TEACHER_FIELDS })) as ClassConfig | null;

  return NextResponse.json({
    data: parseStoredTeacherTimetable(config?.teacherTimetableJson),
    updatedAt: config?.teacherTimetableUpdatedAt || "",
    isCurrent: Boolean(year?.isCurrent),
    versions: (config?.teacherTimetableHistory ?? []).map(versionMeta),
  });
}

/**
 * Ghi một lịch dạy, dùng chung cho hai đường nhập: tải file Excel và gõ thẳng
 * trên web. Bản đang dùng được lưu lại thành phiên bản cũ trước khi ghi đè.
 */
async function saveTeacherTimetable(
  grid: TeacherTimetableGrid,
  schoolYearId: string,
  session: SessionUser,
) {
  const db = await getDb();
  const now = new Date().toISOString();
  const configs = db.collection<ClassConfig>("classConfigs");
  const existing = await configs.findOne({ schoolYearId });
  const teacherTimetableHistory = archiveCurrentTeacherTimetable(existing, {
    id: session.id,
    fullName: session.fullName,
  });

  await configs.updateOne(
    { schoolYearId },
    {
      $set: {
        teacherTimetableJson: JSON.stringify(grid),
        teacherTimetableUpdatedAt: now,
        teacherTimetableHistory,
        updatedAt: now,
      },
    },
  );

  revalidatePath("/");
  revalidatePath("/lich-day");
  return NextResponse.json({
    ok: true,
    updatedAt: now,
    data: grid,
    versions: teacherTimetableHistory.map(versionMeta),
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
  return saveTeacherTimetable(grid, String(year._id), session);
}

/** Gõ thẳng trên web: nhận lưới dạng JSON thay vì file Excel. */
export async function PUT(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { year?: string; grid?: unknown };
  const year = await resolveSchoolYear(body.year || new URL(request.url).searchParams.get("year"));
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem. Chỉ sửa lịch dạy năm hiện hành." }, { status: 400 });
  }

  const grid = sanitizeTeacherTimetableGrid(body.grid);
  if (!grid) return NextResponse.json({ error: "Bảng lịch dạy không hợp lệ." }, { status: 400 });

  return saveTeacherTimetable(grid, String(year._id), session);
}
