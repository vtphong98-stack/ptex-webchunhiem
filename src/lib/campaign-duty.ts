import { alignRowsByStudents, type RosterStudent } from "@/lib/officer-roster";

export type CampaignAssignmentRow = {
  studentId: string;
  fullName: string;
  assignment: string;
};

export function emptyCampaignRows(students: RosterStudent[]): CampaignAssignmentRow[] {
  return students.map((student) => ({
    studentId: student._id,
    fullName: student.fullName,
    assignment: "",
  }));
}

export function parseCampaignAssignments(raw: unknown): CampaignAssignmentRow[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        studentId: String(item?.studentId ?? ""),
        fullName: String(item?.fullName ?? "").trim(),
        assignment: String(item?.assignment ?? "").trim(),
      }))
      .filter((item) => item.fullName);
  } catch {
    return [];
  }
}

export function alignCampaignRows(students: RosterStudent[], saved: CampaignAssignmentRow[]) {
  return alignRowsByStudents(students, saved, (student) => ({
    studentId: student._id,
    fullName: student.fullName,
    assignment: "",
  }));
}

export function summarizeCampaignAssignments(raw: unknown) {
  return formatCampaignAssignments(raw);
}

export function formatCampaignAssignments(raw: unknown) {
  const rows = parseCampaignAssignments(raw).filter((row) => row.assignment.trim());
  if (!rows.length) return "";
  return rows.map((row) => `- ${row.fullName}: ${row.assignment}`).join("\n");
}

export function formatCampaignCopyText(input: {
  weekLabel: string;
  campaignName?: string;
  implementationTime?: string;
  progress?: string;
  assignmentsRaw: unknown;
}) {
  const lines = [`PHÂN CÔNG PHONG TRÀO · ${input.weekLabel}`];
  if (input.campaignName?.trim()) lines.push(`Tên phong trào: ${input.campaignName.trim()}`);
  if (input.implementationTime?.trim()) lines.push(`Thời gian: ${input.implementationTime.trim()}`);
  if (input.progress?.trim()) lines.push(`Tiến độ: ${input.progress.trim()}`);
  const body = formatCampaignAssignments(input.assignmentsRaw);
  if (body) lines.push("", body);
  return lines.join("\n").trim();
}
