import { weekSelectSuffix, type WeekLockState } from "@/lib/week-lock";

export function weekOptionLabel(
  week: { weekNumber: number; label: string; dateRangeLabel?: string },
  lock?: WeekLockState | null,
) {
  return `${week.label}${week.dateRangeLabel ? ` · ${week.dateRangeLabel}` : ""}${weekSelectSuffix(lock)}`;
}

export function WeekLockBanner({ lock }: { lock?: WeekLockState | null }) {
  if (!lock) return null;
  if (lock.locked) {
    return (
      <p className="week-lock-banner week-lock-banner-locked" role="alert">
        {lock.message}
      </p>
    );
  }
  if (lock.source === "unlocked") {
    return (
      <p className="week-lock-banner week-lock-banner-open" role="status">
        GVCN đã mở khóa tuần này. Ban cán sự có thể gửi / sửa báo cáo.
      </p>
    );
  }
  if (lock.lockAtLabel) {
    return (
      <p className="week-lock-banner week-lock-banner-soon" role="status">
        Tuần này đang mở. Sẽ khóa tự động {lock.lockAtLabel}.
      </p>
    );
  }
  return null;
}
