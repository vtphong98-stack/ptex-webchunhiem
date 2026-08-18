import { ARCHIVE_SCHOOL_YEAR, CURRENT_SCHOOL_YEAR, buildWeeks2026 } from "@/lib/academic-calendar";
import { ensureSeedData } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import type { ClassConfig, SchoolYear } from "@/lib/types";
import { buildWeeks2025 } from "@/lib/weeks";

export async function resolveSchoolYear(yearName?: string | null) {
  await ensureSeedData();
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

export async function resolveClassConfig(schoolYearId: string) {
  const db = await getDb();
  return db.collection<ClassConfig>("classConfigs").findOne({ schoolYearId });
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
