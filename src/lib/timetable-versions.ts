import type { ClassConfig, TimetableVersion } from "@/lib/types";

const HISTORY_CAP = 20;

/**
 * Đẩy bản đang dùng vào đầu danh sách phiên bản cũ.
 *
 * Dùng chung cho thời khóa biểu lớp và lịch dạy giáo viên — hai bản ghi khác
 * cột nhưng cùng một cách lưu lịch sử.
 */
export function archiveTimetable(
  current: { json?: string; updatedAt?: string; history?: TimetableVersion[]; fallbackAt?: string },
  actor: { id: string; fullName: string },
): TimetableVersion[] {
  const history = [...(current.history ?? [])];
  if (!current.json) return history;
  history.unshift({
    id: crypto.randomUUID(),
    createdAt: current.updatedAt || current.fallbackAt || new Date().toISOString(),
    createdBy: actor.id,
    createdByName: actor.fullName,
    timetableJson: current.json,
  });
  return history.slice(0, HISTORY_CAP);
}

export function archiveCurrentTimetable(
  config: Pick<ClassConfig, "timetableJson" | "timetableUpdatedAt" | "timetableHistory" | "updatedAt"> | null,
  actor: { id: string; fullName: string },
): TimetableVersion[] {
  return archiveTimetable(
    {
      json: config?.timetableJson,
      updatedAt: config?.timetableUpdatedAt,
      history: config?.timetableHistory,
      fallbackAt: config?.updatedAt,
    },
    actor,
  );
}

export function archiveCurrentTeacherTimetable(
  config: Pick<
    ClassConfig,
    "teacherTimetableJson" | "teacherTimetableUpdatedAt" | "teacherTimetableHistory" | "updatedAt"
  > | null,
  actor: { id: string; fullName: string },
): TimetableVersion[] {
  return archiveTimetable(
    {
      json: config?.teacherTimetableJson,
      updatedAt: config?.teacherTimetableUpdatedAt,
      history: config?.teacherTimetableHistory,
      fallbackAt: config?.updatedAt,
    },
    actor,
  );
}

export function versionMeta(item: TimetableVersion) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    createdByName: item.createdByName || "",
  };
}
