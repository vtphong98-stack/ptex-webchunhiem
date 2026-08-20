import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { YEAR_MILESTONES, type Milestone, parseMilestonesJson } from "@/lib/academic-calendar";
import { getDb } from "@/lib/db";
import { canManageStudents } from "@/lib/permissions";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYearFromRequest } from "@/lib/school-year-scope";
import { getVerifiedSessionUser } from "@/lib/session";
import type { ClassConfig } from "@/lib/types";

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
      return NextResponse.json({ data: YEAR_MILESTONES, updatedAt: "" });
    }

    const config = await resolveClassConfig(String(schoolYear._id), { ...CLASS_CONFIG_FIELDS.milestones });
    const raw = config?.milestonesJson;
    return NextResponse.json(
      {
        data: parseMilestonesJson(raw),
        updatedAt: config?.milestonesUpdatedAt || "",
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch {
    return NextResponse.json({ data: YEAR_MILESTONES, updatedAt: "" }, { status: 500 });
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
    const body = (await request.json()) as { data: Milestone[] };
    const milestones = body.data;
    if (!Array.isArray(milestones) || !milestones.length) {
      return NextResponse.json({ error: "Missing milestones data" }, { status: 400 });
    }

    const schoolYearId = String(schoolYear._id);
    const nowIso = new Date().toISOString();
    const jsonStr = JSON.stringify(milestones);

    const db = await getDb();
    await db.collection<ClassConfig>("classConfigs").updateOne(
      { schoolYearId },
      {
        $set: {
          milestonesJson: jsonStr,
          milestonesUpdatedAt: nowIso,
          updatedAt: nowIso,
        },
      },
      { upsert: true },
    );

    revalidatePath("/");
    revalidatePath("/tong-ket");
    // Two tags, two calls — the second argument is a cache-life profile, not a
    // second tag, so the old one-liner never touched "public-site".
    revalidateTag("milestones", "max");
    revalidateTag("public-site", "max");

    return NextResponse.json({ ok: true, updatedAt: nowIso });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save milestones" },
      { status: 500 },
    );
  }
}
