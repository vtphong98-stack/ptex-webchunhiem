import { buildExcelWeeks, EXCEL_WEEK_COUNT } from "@/lib/weeks";

/** Asia/Ho_Chi_Minh = UTC+7. Saturday 00:00 VN = Friday 17:00 UTC. */
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type WeekLockOverride = "open" | "locked";

export type WeekLockState = {
  weekNumber: number;
  locked: boolean;
  source: "auto" | "manual" | "unlocked" | "open";
  override: WeekLockOverride | null;
  lockAt: string;
  lockAtLabel: string;
  message: string;
};

const LOCKED_MESSAGE =
  "Tuần này đã khóa. Ban cán sự không thể sửa. Chỉ giáo viên chủ nhiệm mới mở khóa được.";

export function vietnamCalendarParts(date: Date) {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** 00:00 of a VN calendar date, as UTC instant. */
export function vietnamMidnightUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS);
}

function saturdayFromIsoDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return vietnamMidnightUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function getWeekLockAt(weekNumber: number): Date | null {
  const weeks = buildExcelWeeks();
  const week = weeks.find((item) => item.weekNumber === weekNumber);
  if (week?.endDate) return saturdayFromIsoDate(week.endDate);
  if (week?.startDate) {
    const start = new Date(week.startDate);
    return vietnamMidnightUtc(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate() + 5);
  }

  const dated = weeks.filter((item) => item.endDate);
  const prev = [...dated].reverse().find((item) => item.weekNumber < weekNumber);
  if (prev?.endDate) {
    const end = new Date(prev.endDate);
    const days = 7 * (weekNumber - prev.weekNumber);
    return vietnamMidnightUtc(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate() + days);
  }
  const next = dated.find((item) => item.weekNumber > weekNumber);
  if (next?.endDate) {
    const end = new Date(next.endDate);
    const days = 7 * (next.weekNumber - weekNumber);
    return vietnamMidnightUtc(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate() - days);
  }
  return null;
}

export function formatLockAtLabel(lockAt: Date | null) {
  if (!lockAt) return "";
  const parts = vietnamCalendarParts(lockAt);
  return `0h thứ 7 · ${parts.day}/${parts.month}/${parts.year}`;
}

export function resolveWeekLock(
  weekNumber: number,
  override: WeekLockOverride | null,
  now = new Date(),
): WeekLockState {
  const lockAt = getWeekLockAt(weekNumber);
  const autoLocked = Boolean(lockAt && now.getTime() >= lockAt.getTime());
  const lockAtIso = lockAt?.toISOString() ?? "";
  const lockAtLabel = formatLockAtLabel(lockAt);

  if (override === "locked") {
    return {
      weekNumber,
      locked: true,
      source: "manual",
      override,
      lockAt: lockAtIso,
      lockAtLabel,
      message: LOCKED_MESSAGE,
    };
  }

  if (override === "open") {
    return {
      weekNumber,
      locked: false,
      source: "unlocked",
      override,
      lockAt: lockAtIso,
      lockAtLabel,
      message: "GVCN đã mở khóa tuần này.",
    };
  }

  if (autoLocked) {
    return {
      weekNumber,
      locked: true,
      source: "auto",
      override: null,
      lockAt: lockAtIso,
      lockAtLabel,
      message: `Tuần này đã khóa tự động lúc ${lockAtLabel}. Ban cán sự không thể sửa. Chỉ GVCN mới mở khóa được.`,
    };
  }

  return {
    weekNumber,
    locked: false,
    source: "open",
    override: null,
    lockAt: lockAtIso,
    lockAtLabel,
    message: lockAtLabel ? `Tự khóa ${lockAtLabel}` : "",
  };
}

export function buildAllWeekLocks(overrides: Map<number, WeekLockOverride>, now = new Date()) {
  const states: WeekLockState[] = [];
  for (let weekNumber = 1; weekNumber <= EXCEL_WEEK_COUNT; weekNumber += 1) {
    states.push(resolveWeekLock(weekNumber, overrides.get(weekNumber) ?? null, now));
  }
  return states;
}

export function findLock(locks: WeekLockState[], weekNumber: number) {
  return locks.find((item) => item.weekNumber === weekNumber) ?? resolveWeekLock(weekNumber, null);
}

export function pickDefaultOfficerWeek(locks: WeekLockState[], fallback = 1) {
  const now = Date.now();
  const inWindow = [...locks]
    .reverse()
    .find((item) => !item.locked && item.lockAt && new Date(item.lockAt).getTime() > now);
  if (inWindow) return inWindow.weekNumber;
  const unlocked = [...locks].reverse().find((item) => !item.locked);
  return unlocked?.weekNumber ?? fallback;
}

export function weekSelectSuffix(lock?: WeekLockState | null) {
  if (!lock) return "";
  if (lock.locked) return " · ĐÃ KHÓA";
  if (lock.source === "unlocked") return " · GVCN mở khóa";
  return "";
}
