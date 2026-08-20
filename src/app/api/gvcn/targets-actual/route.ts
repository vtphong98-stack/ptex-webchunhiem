import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isGvcnRole } from "@/lib/access";
import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { resolveClassConfig, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { ClassConfig, ClassTargetsActual, SemesterActual } from "@/lib/types";

const ACTUAL_FIELDS = { targetsActualJson: 1, targetsActualUpdatedAt: 1 } as const;

function emptySemester(): SemesterActual {
  return {
    totalStudents: 0,
    conduct: { tot: 0, kha: 0, dat: 0, chuaDat: 0 },
    academic: { tot: 0, kha: 0, dat: 0, chuaDat: 0, xuatSac: 0 },
    note: "",
  };
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

/** Coerce whatever the client sent into the exact shape we store. */
function sanitise(raw: unknown): SemesterActual {
  const input = (raw ?? {}) as Record<string, Record<string, unknown> | unknown>;
  const conduct = (input.conduct ?? {}) as Record<string, unknown>;
  const academic = (input.academic ?? {}) as Record<string, unknown>;
  return {
    totalStudents: num(input.totalStudents),
    conduct: { tot: num(conduct.tot), kha: num(conduct.kha), dat: num(conduct.dat), chuaDat: num(conduct.chuaDat) },
    academic: {
      tot: num(academic.tot),
      kha: num(academic.kha),
      dat: num(academic.dat),
      chuaDat: num(academic.chuaDat),
      xuatSac: num(academic.xuatSac),
    },
    note: typeof input.note === "string" ? input.note.slice(0, 500) : "",
  };
}

export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !isGvcnRole(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await resolveSchoolYearFromRequest(request);
  if (!schoolYear?._id) return NextResponse.json({ data: null, updatedAt: "" });

  const config = await resolveClassConfig(String(schoolYear._id), { ...ACTUAL_FIELDS });
  const raw = (config as Record<string, unknown>)?.targetsActualJson as string | undefined;
  let data: ClassTargetsActual = { hk1: emptySemester(), hk2: emptySemester() };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<ClassTargetsActual>;
      data = { hk1: sanitise(parsed.hk1), hk2: sanitise(parsed.hk2), updatedAt: parsed.updatedAt };
    } catch {
      // fall through to the empty shape
    }
  }

  return NextResponse.json(
    { data, updatedAt: ((config as Record<string, unknown>)?.targetsActualUpdatedAt as string) || "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !isGvcnRole(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await resolveSchoolYearFromRequest(request);
  if (!schoolYear?._id) return NextResponse.json({ error: "Không có năm học." }, { status: 400 });
  if (!schoolYear.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { data?: Partial<ClassTargetsActual> };
    const nowIso = new Date().toISOString();
    const data: ClassTargetsActual = {
      hk1: sanitise(body.data?.hk1),
      hk2: sanitise(body.data?.hk2),
      updatedAt: nowIso,
    };

    const schoolYearId = String(schoolYear._id);
    const db = await getDb();
    await db.collection<ClassConfig>("classConfigs").updateOne(
      { schoolYearId },
      { $set: { targetsActualJson: JSON.stringify(data), targetsActualUpdatedAt: nowIso, updatedAt: nowIso } },
      { upsert: true },
    );

    await createAuditLog({
      schoolYearId,
      entityType: "classConfig",
      entityId: schoolYearId,
      action: "update",
      summary: "Cập nhật kết quả thực tế đối chiếu chỉ tiêu.",
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });

    revalidatePath("/chi-tieu");
    return NextResponse.json({ ok: true, data, updatedAt: nowIso });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không lưu được." },
      { status: 500 },
    );
  }
}
