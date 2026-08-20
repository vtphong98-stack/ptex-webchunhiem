import { cache } from "react";

import { ARCHIVE_SCHOOL_YEAR, CURRENT_SCHOOL_YEAR, buildWeeks2026 } from "@/lib/academic-calendar";
import { ensureSeedData } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import type { ClassConfig, SchoolYear } from "@/lib/types";
import { buildWeeks2025 } from "@/lib/weeks";

/**
 * classConfigs holds a few very large JSON blobs (teachingPlanJson alone is
 * ~29 KB). Reading the whole document costs roughly twice the round-trip of a
 * projected read, so every caller asks for just the keys it renders.
 */
export const CLASS_CONFIG_FIELDS = {
  identity: { className: 1, fullName: 1, gvcnName: 1, gvcnDisplayName: 1, gvcnPhone: 1, gvcnZalo: 1 },
  timetable: { timetableJson: 1, timetableUpdatedAt: 1, timetableHistory: 1 },
  milestones: { milestonesJson: 1, milestonesUpdatedAt: 1 },
  targets: { targetsJson: 1, targetsUpdatedAt: 1 },
  teacherTimetable: { teacherTimetableJson: 1, teacherTimetableUpdatedAt: 1 },
  teachingPlan: { teachingPlanJson: 1, teachingPlanUpdatedAt: 1 },
} as const;

async function findSchoolYear(yearName?: string | null) {
  const db = await getDb();
  const years = db.collection<SchoolYear>("schoolYears");
  if (yearName) {
    const named = await years.findOne({ name: yearName });
    if (named) return named;
  }
  return (
    (await years.findOne({ isCurrent: true })) ??
    (await years.findOne({ name: CURRENT_SCHOOL_YEAR })) ??
    (await years.findOne({}))
  );
}

/** Deduped per render pass so sibling components share one round trip. */
const findSchoolYearCached = cache(findSchoolYear);

export async function resolveSchoolYear(yearName?: string | null, options?: { seed?: boolean }) {
  if (options?.seed !== false) await ensureSeedData();
  return findSchoolYearCached(yearName ?? null);
}

/**
 * @param projection Mongo projection; pass one of CLASS_CONFIG_FIELDS (or a
 * merge of them) to avoid dragging the big JSON blobs over the wire.
 */
export async function resolveClassConfig(
  schoolYearId: string,
  projection?: Record<string, 0 | 1>,
) {
  if (!schoolYearId) return null;
  const db = await getDb();
  return db
    .collection<ClassConfig>("classConfigs")
    .findOne({ schoolYearId }, projection ? { projection } : undefined);
}

export async function listSchoolYears() {
  const db = await getDb();
  return db
    .collection<SchoolYear>("schoolYears")
    .find({}, { projection: { name: 1, label: 1, isCurrent: 1, weekCount: 1 } })
    .sort({ name: -1 })
    .toArray();
}

export async function resolveSchoolYearFromRequest(request: Request) {
  return resolveSchoolYear(new URL(request.url).searchParams.get("year"));
}

export function weeksOfYear(year: Pick<SchoolYear, "name" | "weeks"> | null | undefined) {
  if (year?.weeks?.length) return year.weeks;
  if (year?.name === ARCHIVE_SCHOOL_YEAR) return buildWeeks2025();
  return buildWeeks2026();
}

export function yearQuery(yearName?: string | null) {
  if (!yearName) return "";
  return `year=${encodeURIComponent(yearName)}`;
}
