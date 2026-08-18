import type { ClassDuty, Student, TeamRole } from "@/lib/types";
import { CLASS_DUTIES } from "@/lib/types";

export type TeamMemberWeekRow = {
  studentId: string;
  fullName: string;
  teamRole: TeamRole | null;
  absentCount: number;
  absentDates: string;
  lateCount: number;
  lateDates: string;
  notPreparedCount: number;
  notPreparedSubjects: string;
  noHomeworkCount: number;
  disorderCount: number;
  violationCount: number;
  violationDetail: string;
  goodPointsCount: number;
  participationCount: number;
};

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  toTruong: "Tổ trưởng",
  toPho: "Tổ phó",
  thanhVien: "Thành viên",
};

export const CLASS_DUTY_LABELS: Record<ClassDuty, string> = {
  lopTruong: "Lớp trưởng",
  lopPhoHocTap: "Lớp phó học tập",
  lopPhoLaoDong: "Lớp phó lao động",
  lopPhoPhongTrao: "Lớp phó phong trào",
  lopPhoTratTu: "Lớp phó trật tự",
  thuQuy: "Thủ quỹ",
};

export const CLASS_DUTY_USERNAME: Record<ClassDuty, string> = {
  lopTruong: "lt",
  lopPhoHocTap: "lpht",
  lopPhoLaoDong: "lpld",
  lopPhoPhongTrao: "lppt",
  lopPhoTratTu: "lptt",
  thuQuy: "thuquy",
};

export function normalizePersonName(value: string) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function formatBirthDate(student: Pick<Student, "birthDay" | "birthMonth" | "birthYear">) {
  const day = String(student.birthDay || "").padStart(2, "0");
  const month = String(student.birthMonth || "").padStart(2, "0");
  if (student.birthYear) return `${day}/${month}/${student.birthYear}`;
  if (student.birthDay && student.birthMonth) return `${day}/${month}`;
  return "";
}

export function parseTeamRole(raw: string | null | undefined): TeamRole | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("trưởng") && !value.includes("phó") && !value.includes("lớp")) return "toTruong";
  if (value.includes("totruong") || value === "tt" || value === "tổ trưởng") return "toTruong";
  if (value.includes("phó") && (value.includes("tổ") || value.includes("to pho") || value.includes("topho"))) return "toPho";
  if (value.includes("topho") || value === "tp") return "toPho";
  if (value.includes("thành viên") || value.includes("thanh vien") || value === "tv") return "thanhVien";
  return "thanhVien";
}

export function parseClassDuty(raw: string | null | undefined): ClassDuty | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("học tập") || value.includes("hoc tap") || value === "lpht") return "lopPhoHocTap";
  if (value.includes("lao động") || value.includes("lao dong") || value === "lpld") return "lopPhoLaoDong";
  if (value.includes("phong trào") || value.includes("phong trao") || value === "lppt") return "lopPhoPhongTrao";
  if (value.includes("trật tự") || value.includes("trat tu") || value === "lptt") return "lopPhoTratTu";
  if (value.includes("thủ quỹ") || value.includes("thu quy") || value === "thuquy") return "thuQuy";
  if ((value.includes("lớp trưởng") || value.includes("lop truong") || value === "lt") && !value.includes("phó")) {
    return "lopTruong";
  }
  return null;
}

export function studentPositionLabel(student: Pick<Student, "teamRole" | "classDuty" | "position">) {
  const parts: string[] = [];
  if (student.classDuty) parts.push(CLASS_DUTY_LABELS[student.classDuty]);
  if (student.teamRole === "toTruong") parts.push("Tổ trưởng");
  if (student.teamRole === "toPho") parts.push("Tổ phó");
  return parts.join(" · ") || student.position || "";
}

export function sortTeamStudents<T extends Pick<Student, "teamRole" | "fullName">>(students: T[]) {
  const rank = (role: TeamRole | null | undefined) => {
    if (role === "toTruong") return 0;
    if (role === "toPho") return 1;
    return 2;
  };
  return [...students].sort((a, b) => {
    const byRole = rank(a.teamRole) - rank(b.teamRole);
    if (byRole !== 0) return byRole;
    return a.fullName.localeCompare(b.fullName, "vi");
  });
}

export function emptyMemberRow(student: Pick<Student, "_id" | "fullName" | "teamRole">): TeamMemberWeekRow {
  return {
    studentId: String(student._id ?? ""),
    fullName: student.fullName,
    teamRole: student.teamRole,
    absentCount: 0,
    absentDates: "",
    lateCount: 0,
    lateDates: "",
    notPreparedCount: 0,
    notPreparedSubjects: "",
    noHomeworkCount: 0,
    disorderCount: 0,
    violationCount: 0,
    violationDetail: "",
    goodPointsCount: 0,
    participationCount: 0,
  };
}

function toCount(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function joinUnique(current: string, extra: string) {
  const parts = [...current.split(/[;,]/), ...extra.split(/[;,]/)]
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(parts)].join("; ");
}

function memberHasInput(row: TeamMemberWeekRow) {
  return (
    row.absentCount > 0 ||
    row.lateCount > 0 ||
    row.notPreparedCount > 0 ||
    row.noHomeworkCount > 0 ||
    row.disorderCount > 0 ||
    row.violationCount > 0 ||
    row.goodPointsCount > 0 ||
    row.participationCount > 0 ||
    Boolean(row.absentDates.trim()) ||
    Boolean(row.lateDates.trim()) ||
    Boolean(row.notPreparedSubjects.trim()) ||
    Boolean(row.violationDetail.trim())
  );
}

export function parseMemberRows(raw: unknown): TeamMemberWeekRow[] {
  if (typeof raw === "string" && raw.trim()) {
    try {
      return parseMemberRows(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    studentId: String(item?.studentId ?? ""),
    fullName: String(item?.fullName ?? ""),
    teamRole: (item?.teamRole as TeamRole) ?? null,
    absentCount: toCount(item?.absentCount),
    absentDates: String(item?.absentDates ?? ""),
    lateCount: toCount(item?.lateCount),
    lateDates: String(item?.lateDates ?? ""),
    notPreparedCount: toCount(item?.notPreparedCount),
    notPreparedSubjects: String(item?.notPreparedSubjects ?? ""),
    noHomeworkCount: toCount(item?.noHomeworkCount),
    disorderCount: toCount(item?.disorderCount),
    violationCount: toCount(item?.violationCount),
    violationDetail: String(item?.violationDetail ?? ""),
    goodPointsCount: toCount(item?.goodPointsCount),
    participationCount: toCount(item?.participationCount),
  }));
}

export function mergeMemberRows(existing: TeamMemberWeekRow[], incoming: TeamMemberWeekRow[]) {
  const map = new Map(existing.map((row) => [row.studentId || normalizePersonName(row.fullName), { ...row }]));
  for (const row of incoming) {
    if (!memberHasInput(row)) continue;
    const key = row.studentId || normalizePersonName(row.fullName);
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...row });
      continue;
    }
    map.set(key, {
      ...current,
      fullName: row.fullName || current.fullName,
      teamRole: row.teamRole ?? current.teamRole,
      absentCount: current.absentCount + row.absentCount,
      absentDates: joinUnique(current.absentDates, row.absentDates),
      lateCount: current.lateCount + row.lateCount,
      lateDates: joinUnique(current.lateDates, row.lateDates),
      notPreparedCount: current.notPreparedCount + row.notPreparedCount,
      notPreparedSubjects: joinUnique(current.notPreparedSubjects, row.notPreparedSubjects),
      noHomeworkCount: current.noHomeworkCount + row.noHomeworkCount,
      disorderCount: current.disorderCount + row.disorderCount,
      violationCount: current.violationCount + row.violationCount,
      violationDetail: joinUnique(current.violationDetail, row.violationDetail),
      goodPointsCount: current.goodPointsCount + row.goodPointsCount,
      participationCount: current.participationCount + row.participationCount,
    });
  }
  return [...map.values()];
}

function namedCount(rows: TeamMemberWeekRow[], countKey: keyof TeamMemberWeekRow, extraKey?: keyof TeamMemberWeekRow) {
  return rows
    .filter((row) => toCount(row[countKey]) > 0)
    .map((row) => {
      const extra = extraKey ? String(row[extraKey] ?? "").trim() : "";
      const count = toCount(row[countKey]);
      return extra ? `${row.fullName}(${count}; ${extra})` : `${row.fullName}(${count})`;
    })
    .join("; ");
}

export function membersToReportFields(members: TeamMemberWeekRow[]) {
  const sum = (key: keyof TeamMemberWeekRow) => members.reduce((total, row) => total + toCount(row[key]), 0);
  return {
    members_json: JSON.stringify(members),
    not_prepared_names: namedCount(members, "notPreparedCount", "notPreparedSubjects"),
    not_prepared_count: String(sum("notPreparedCount")),
    no_homework_names: namedCount(members, "noHomeworkCount"),
    no_homework_count: String(sum("noHomeworkCount")),
    disorder_names: namedCount(members, "disorderCount"),
    disorder_count: String(sum("disorderCount")),
    late_names: namedCount(members, "lateCount", "lateDates"),
    late_count: String(sum("lateCount")),
    violation_names: namedCount(members, "violationCount", "violationDetail"),
    violation_count: String(sum("violationCount")),
    absent_names: namedCount(members, "absentCount", "absentDates"),
    absent_count: String(sum("absentCount")),
    good_points_names: namedCount(members, "goodPointsCount"),
    good_points_count: String(sum("goodPointsCount")),
    participation_names: namedCount(members, "participationCount"),
    participation_count: String(sum("participationCount")),
  };
}

export function teamLeaderUsername(teamNumber: number) {
  return `tt${teamNumber}`;
}

export function classDutyOptions() {
  return CLASS_DUTIES.map((duty) => ({ value: duty, label: CLASS_DUTY_LABELS[duty] }));
}
