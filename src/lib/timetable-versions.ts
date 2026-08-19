import type { ClassConfig, TimetableVersion } from "@/lib/types";

const HISTORY_CAP = 20;

export function archiveCurrentTimetable(
  config: Pick<ClassConfig, "timetableJson" | "timetableUpdatedAt" | "timetableHistory" | "updatedAt"> | null,
  actor: { id: string; fullName: string },
): TimetableVersion[] {
  const history = [...(config?.timetableHistory ?? [])];
  if (!config?.timetableJson) return history;
  history.unshift({
    id: crypto.randomUUID(),
    createdAt: config.timetableUpdatedAt || config.updatedAt || new Date().toISOString(),
    createdBy: actor.id,
    createdByName: actor.fullName,
    timetableJson: config.timetableJson,
  });
  return history.slice(0, HISTORY_CAP);
}

export function versionMeta(item: TimetableVersion) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    createdByName: item.createdByName || "",
  };
}
