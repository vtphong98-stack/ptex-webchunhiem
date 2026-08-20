import { getDb } from "@/lib/db";
import type { SchoolWeek } from "@/lib/types";
import {
  buildAllWeekLocks,
  findLock,
  type WeekLockOverride,
  type WeekLockState,
} from "@/lib/week-lock";

export type WeekLockDoc = {
  _id: string;
  schoolYearId: string;
  weekNumber: number;
  override: WeekLockOverride;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
};

export async function loadWeekLockOverrides(schoolYearId: string) {
  if (!schoolYearId) return new Map<number, WeekLockOverride>();
  const db = await getDb();
  const rows = await db
    .collection<WeekLockDoc>("weekLocks")
    .find({ schoolYearId }, { projection: { weekNumber: 1, override: 1 } })
    .toArray();
  return new Map(rows.map((row) => [row.weekNumber, row.override]));
}

async function loadYearWeeks(schoolYearId: string) {
  if (!schoolYearId) return null;
  const db = await getDb();
  return db.collection<{ weeks?: SchoolWeek[] }>("schoolYears").findOne(
    { _id: schoolYearId } as never,
    { projection: { weeks: 1 } },
  );
}

export async function getWeekLockStates(schoolYearId: string, now = new Date()) {
  // The overrides and the week table are independent reads — one round trip
  // instead of two.
  const [overrides, year] = await Promise.all([
    loadWeekLockOverrides(schoolYearId),
    loadYearWeeks(schoolYearId),
  ]);
  return buildAllWeekLocks(overrides, now, year?.weeks?.length ? year.weeks : undefined);
}

export async function getWeekLockState(schoolYearId: string, weekNumber: number, now = new Date()) {
  const states = await getWeekLockStates(schoolYearId, now);
  return findLock(states, weekNumber);
}

export function weekLockedError(lock: WeekLockState) {
  return lock.locked ? lock.message : "";
}

export async function assertWeekWritable(schoolYearId: string, weekNumber: number) {
  const lock = await getWeekLockState(schoolYearId, weekNumber);
  return weekLockedError(lock);
}
