import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { ClassConfig, ClassTargets } from "@/lib/types";

export async function GET(request: Request) {
  // Only ever read from GVCN-gated screens, so the GET is gated too — this used
  // to hand the teacher's data to anonymous callers.
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const schoolYear = await resolveSchoolYearFromRequest(request);
    if (!schoolYear?._id) {
      return NextResponse.json({ data: null, updatedAt: "" });
    }

    const config = await resolveClassConfig(String(schoolYear._id), { ...CLASS_CONFIG_FIELDS.targets });
    const raw = config?.targetsJson;
    return NextResponse.json(
      {
        data: raw ? JSON.parse(raw) : null,
        updatedAt: config?.targetsUpdatedAt || "",
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch {
    return NextResponse.json({ data: null, updatedAt: "" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await resolveSchoolYearFromRequest(request);
  if (!schoolYear?._id) {
    return NextResponse.json({ error: "School year not found" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { data: ClassTargets };
    const targets = body.data;
    if (!targets) {
      return NextResponse.json({ error: "Missing targets data" }, { status: 400 });
    }

    const schoolYearId = String(schoolYear._id);
    const nowIso = new Date().toISOString();
    targets.updatedAt = nowIso;
    const jsonStr = JSON.stringify(targets);

    const db = await getDb();
    await db.collection<ClassConfig>("classConfigs").updateOne(
      { schoolYearId },
      {
        $set: {
          targetsJson: jsonStr,
          targetsUpdatedAt: nowIso,
          updatedAt: nowIso,
        },
      },
      { upsert: true },
    );

    revalidatePath("/chi-tieu");
    revalidatePath("/");
    // Two tags, two calls — the second argument is a cache-life profile.
    revalidateTag("targets", "max");
    revalidateTag("class-targets", "max");

    return NextResponse.json({ ok: true, updatedAt: nowIso });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save targets" },
      { status: 500 },
    );
  }
}
