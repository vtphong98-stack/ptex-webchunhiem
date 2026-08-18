export const LABOR_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7"] as const;
export const LABOR_TASKS = ["Quét lớp", "Lau bảng", "Mang ghế chào cờ"] as const;

export type LaborDay = (typeof LABOR_DAYS)[number];
export type LaborTask = (typeof LABOR_TASKS)[number];

export type LaborAssignmentRow = {
  studentId: string;
  fullName: string;
  laborDay: LaborDay | "";
  task: LaborTask | "";
};

export type LaborStudent = { _id: string; fullName: string };

export function dutyTeamForWeek(weekNumber: number) {
  return ((Math.max(weekNumber, 1) - 1) % 4) + 1;
}

export function parseLaborAssignments(raw: unknown): LaborAssignmentRow[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        studentId: String(item?.studentId ?? ""),
        fullName: String(item?.fullName ?? "").trim(),
        laborDay: LABOR_DAYS.includes(item?.laborDay) ? item.laborDay : ("" as const),
        task: LABOR_TASKS.includes(item?.task) ? item.task : ("" as const),
      }))
      .filter((item) => item.fullName);
  } catch {
    return [];
  }
}

export function emptyLaborRows(students: LaborStudent[]): LaborAssignmentRow[] {
  return students.map((student) => ({
    studentId: student._id,
    fullName: student.fullName,
    laborDay: "",
    task: "",
  }));
}

export function alignLaborRows(students: LaborStudent[], saved: LaborAssignmentRow[]) {
  const byKey = new Map(saved.map((row) => [row.studentId || row.fullName, row]));
  return students.map((student) => {
    const hit = byKey.get(student._id) ?? byKey.get(student.fullName);
    return {
      studentId: student._id,
      fullName: student.fullName,
      laborDay: hit?.laborDay ?? "",
      task: hit?.task ?? "",
    };
  });
}

export function summarizeLaborAssignments(raw: unknown) {
  const rows = parseLaborAssignments(raw).filter((row) => row.laborDay && row.task);
  if (!rows.length) return "";
  return rows.map((row) => `${row.fullName} (${row.laborDay} · ${row.task})`).join("; ");
}

export function findLaborReuseSource(
  reports: Array<{ weekNumber: number; weekLabel: string; fields: Record<string, string> }>,
  dutyTeam: number,
  currentWeek: number,
) {
  return (
    reports
      .filter(
        (report) =>
          report.weekNumber < currentWeek &&
          Number(report.fields?.duty_team) === dutyTeam &&
          report.fields?.labor_assignments_json?.trim(),
      )
      .sort((a, b) => b.weekNumber - a.weekNumber)[0] ?? null
  );
}

export function applyLaborReuse(students: LaborStudent[], saved: LaborAssignmentRow[]) {
  return alignLaborRows(students, saved);
}
