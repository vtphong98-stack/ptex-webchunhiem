import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { canManageSchoolYears } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { ClassConfig } from "@/lib/types";

function classFullName(className: string, yearName: string) {
  return `Lớp ${className} - ${yearName}`;
}

export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageSchoolYears(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  const schoolYearId = year?._id ? String(year._id) : "";
  const config = await resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.identity });
  return NextResponse.json({
    className: config?.className ?? "",
    fullName: config?.fullName ?? "",
    yearName: year?.name ?? "",
    isCurrent: Boolean(year?.isCurrent),
  });
}

export async function PATCH(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageSchoolYears(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const year = await resolveSchoolYearFromRequest(request);
  if (!year?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!year.isCurrent) return NextResponse.json({ error: "Năm cũ chỉ xem. Chỉ sửa tên lớp năm hiện hành." }, { status: 400 });

  const payload = (await request.json()) as { className?: string };
  const className = String(payload.className ?? "").trim().replace(/\s+/g, "");
  if (!className) {
    return NextResponse.json({ error: "Cần tên lớp." }, { status: 400 });
  }

  const schoolYearId = String(year._id);
  const db = await getDb();
  const configs = db.collection<ClassConfig>("classConfigs");
  const existing = await configs.findOne({ schoolYearId }, { projection: { _id: 1 } });
  const fullName = classFullName(className, year.name);
  const now = new Date().toISOString();
  if (!existing?._id) {
    return NextResponse.json({ error: "Chưa có cấu hình lớp." }, { status: 400 });
  }
  await configs.updateOne({ _id: existing._id }, { $set: { className, fullName, updatedAt: now } });
  await createAuditLog({
    schoolYearId,
    entityType: "classConfig",
    entityId: String(existing._id),
    action: "update",
    summary: `Đổi tên lớp thành ${className}.`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  revalidatePath("/");
  revalidatePath("/syll");
  revalidatePath("/lien-he-phu-huynh");
  revalidatePath("/lien-he-hoc-sinh");

  return NextResponse.json({ ok: true, className, fullName });
}
