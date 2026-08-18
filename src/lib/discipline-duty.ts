import { alignRowsByStudents, type RosterStudent } from "@/lib/officer-roster";

export type DisciplineRecordRow = {
  studentId: string;
  fullName: string;
  incidentCount: number;
  subject: string;
};

export function emptyDisciplineRows(students: RosterStudent[]): DisciplineRecordRow[] {
  return students.map((student) => ({
    studentId: student._id,
    fullName: student.fullName,
    incidentCount: 0,
    subject: "",
  }));
}

export function parseDisciplineRecords(raw: unknown): DisciplineRecordRow[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        studentId: String(item?.studentId ?? ""),
        fullName: String(item?.fullName ?? "").trim(),
        incidentCount: Math.max(0, Number(item?.incidentCount) || 0),
        subject: String(item?.subject ?? "").trim(),
      }))
      .filter((item) => item.fullName);
  } catch {
    return [];
  }
}

export function alignDisciplineRows(students: RosterStudent[], saved: DisciplineRecordRow[]) {
  return alignRowsByStudents(students, saved, (student) => ({
    studentId: student._id,
    fullName: student.fullName,
    incidentCount: 0,
    subject: "",
  }));
}

export function summarizeDisciplineRecords(raw: unknown) {
  return formatDisciplineRecords(raw);
}

export function formatDisciplineRecords(raw: unknown) {
  const rows = parseDisciplineRecords(raw).filter((row) => row.incidentCount > 0 || row.subject);
  if (!rows.length) return "";
  return rows
    .map((row) => {
      const count = row.incidentCount > 0 ? `${row.incidentCount} lần` : "";
      const detail = row.subject.trim();
      if (count && detail) return `- ${row.fullName}: ${count} · ${detail}`;
      if (count) return `- ${row.fullName}: ${count}`;
      return `- ${row.fullName}: ${detail}`;
    })
    .join("\n");
}

export function formatDisciplineCopyText(input: {
  weekLabel: string;
  dutyTeam?: string;
  recordsRaw: unknown;
  socialMedia?: string;
}) {
  const lines = [`BÁO CÁO TRẬT TỰ · ${input.weekLabel}`];
  if (input.dutyTeam) lines.push(`Tổ: Tổ ${input.dutyTeam.replace(/^Tổ\s*/i, "")}`);
  const body = formatDisciplineRecords(input.recordsRaw);
  if (body) lines.push("", body);
  if (input.socialMedia?.trim()) lines.push("", `Theo dõi mạng: ${input.socialMedia.trim()}`);
  return lines.join("\n").trim();
}
