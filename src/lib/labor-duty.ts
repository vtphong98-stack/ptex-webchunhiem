export const LABOR_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7"] as const;
export const LABOR_TASKS = ["Quét lớp", "Lau bảng", "Mang ghế chào cờ"] as const;

export type LaborDay = (typeof LABOR_DAYS)[number];
export type LaborTask = (typeof LABOR_TASKS)[number];

export const LABOR_DAY_LABELS: Record<LaborDay, string> = {
  T2: "Thứ 2",
  T3: "Thứ 3",
  T4: "Thứ 4",
  T5: "Thứ 5",
  T6: "Thứ 6",
  T7: "Thứ 7",
};

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
  return formatLaborAssignmentsByDay(raw);
}

export function groupLaborAssignmentsByDay(raw: unknown) {
  const rows = parseLaborAssignments(raw).filter((row) => row.laborDay && row.task);
  return LABOR_DAYS.map((day) => ({
    day,
    label: LABOR_DAY_LABELS[day],
    members: rows.filter((row) => row.laborDay === day),
  })).filter((group) => group.members.length);
}

export function formatLaborAssignmentsByDay(raw: unknown) {
  const groups = groupLaborAssignmentsByDay(raw);
  if (!groups.length) return "";
  return groups
    .map((group) => [group.label + ":", ...group.members.map((row) => `- ${row.fullName}: ${row.task}`)].join("\n"))
    .join("\n");
}

export function formatLaborCopyText(input: {
  weekLabel: string;
  dutyTeam?: string;
  assignmentsRaw: unknown;
  review?: string;
}) {
  const lines = [`PHÂN CÔNG LAO ĐỘNG · ${input.weekLabel}`];
  if (input.dutyTeam) lines.push(`Tổ trực: Tổ ${input.dutyTeam.replace(/^Tổ\s*/i, "")}`);
  const body = formatLaborAssignmentsByDay(input.assignmentsRaw);
  if (body) lines.push("", body);
  if (input.review?.trim()) lines.push("", `Nhận xét: ${input.review.trim()}`);
  return lines.join("\n").trim();
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
