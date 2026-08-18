import { OFFICER_SLOTS } from "@/lib/report-fields";
import { getTeamScoresForWeek, toCount } from "@/lib/report-schema";
import { parseMemberRows, type TeamMemberWeekRow } from "@/lib/team-roster";
import type { AppRole, WeeklyReport } from "@/lib/types";

export type ViolationKind =
  | "absent"
  | "late"
  | "notPrepared"
  | "noHomework"
  | "disorder"
  | "violation";

export type ViolationEntry = {
  studentName: string;
  teamNumber: number;
  kind: ViolationKind;
  kindLabel: string;
  count: number;
  detail: string;
};

export type ReportLine = {
  label: string;
  value: string;
  sources: string[];
};

export type ReportSection = {
  id: string;
  title: string;
  lines: ReportLine[];
};

export type OfficerSource = {
  key: string;
  label: string;
  role: AppRole;
  teamNumber: number | null;
  submitted: boolean;
};

export type GvcnWeekReport = {
  title: string;
  dateRange: string;
  text: string;
  sections: ReportSection[];
  violations: ViolationEntry[];
  officerSources: OfficerSource[];
  ranking: { firstPlace: string; scores: Array<{ teamNumber: number; score: number }> };
};

const VIOLATION_LABELS: Record<ViolationKind, string> = {
  absent: "Nghỉ",
  late: "Đi trễ",
  notPrepared: "Không thuộc bài",
  noHomework: "Không BTVN",
  disorder: "Mất trật tự",
  violation: "Vi phạm Đoàn",
};

function text(fields: Record<string, string> | undefined, key: string, fallback = "Không có") {
  const value = fields?.[key]?.trim();
  return value || fallback;
}

function rangeShort(dateRangeLabel?: string) {
  if (!dateRangeLabel) return "";
  return dateRangeLabel.replace(/^từ ngày\s+/i, "").replace(/\s+đến\s+/i, " – ");
}

function findReport(reports: WeeklyReport[], role: AppRole, teamNumber: number | null = null) {
  return reports.find(
    (item) => item.reporterRole === role && (teamNumber == null ? item.teamNumber == null : item.teamNumber === teamNumber),
  );
}

function slotLabel(role: AppRole, teamNumber: number | null) {
  const slot = OFFICER_SLOTS.find((item) => item.role === role && item.teamNumber === teamNumber);
  return slot?.label ?? formatRoleShort(role, teamNumber);
}

function formatRoleShort(role: AppRole, teamNumber: number | null) {
  if (role === "toTruong" && teamNumber) return `TT${teamNumber}`;
  if (role === "lopTruong") return "LT";
  if (role === "lopPhoHocTap") return "LPHT";
  if (role === "lopPhoLaoDong") return "LPLD";
  if (role === "lopPhoPhongTrao") return "LPPT";
  if (role === "lopPhoTratTu") return "LPTT";
  if (role === "thuQuy") return "Thủ quỹ";
  return role;
}

function pushViolation(
  list: ViolationEntry[],
  member: TeamMemberWeekRow,
  teamNumber: number,
  kind: ViolationKind,
  count: number,
  detail: string,
) {
  if (count <= 0 && !detail.trim()) return;
  list.push({
    studentName: member.fullName,
    teamNumber,
    kind,
    kindLabel: VIOLATION_LABELS[kind],
    count: count || 1,
    detail: detail.trim(),
  });
}

export function collectViolationsFromTeams(reports: WeeklyReport[]): ViolationEntry[] {
  const entries: ViolationEntry[] = [];
  for (const report of reports.filter((item) => item.reporterRole === "toTruong")) {
    const teamNumber = report.teamNumber ?? 0;
    if (!teamNumber) continue;
    for (const member of parseMemberRows(report.fields?.members_json)) {
      pushViolation(entries, member, teamNumber, "absent", member.absentCount, member.absentDates);
      pushViolation(entries, member, teamNumber, "late", member.lateCount, member.lateDates);
      pushViolation(entries, member, teamNumber, "notPrepared", member.notPreparedCount, member.notPreparedSubjects);
      pushViolation(entries, member, teamNumber, "noHomework", member.noHomeworkCount, "");
      pushViolation(entries, member, teamNumber, "disorder", member.disorderCount, "");
      pushViolation(entries, member, teamNumber, "violation", member.violationCount, member.violationDetail);
    }
  }
  return entries.sort(
    (a, b) => a.teamNumber - b.teamNumber || a.studentName.localeCompare(b.studentName, "vi") || a.kind.localeCompare(b.kind),
  );
}

function aggregateFromMembers(reports: WeeklyReport[], pick: (member: TeamMemberWeekRow) => { count: number; detail: string }) {
  const parts: string[] = [];
  const sources: string[] = [];
  for (const report of reports.filter((item) => item.reporterRole === "toTruong")) {
    const teamNumber = report.teamNumber ?? 0;
    const members = parseMemberRows(report.fields?.members_json);
    if (!members.length) continue;
    const label = slotLabel("toTruong", teamNumber);
    let hasData = false;
    for (const member of members) {
      const { count, detail } = pick(member);
      if (count <= 0 && !detail.trim()) continue;
      hasData = true;
      parts.push(detail.trim() ? `${member.fullName} (${count}; ${detail})` : `${member.fullName} (${count})`);
    }
    if (hasData) sources.push(label);
  }
  return { value: parts.join("; ") || "", sources };
}

function mergeFieldAndMembers(
  reports: WeeklyReport[],
  fieldKey: string,
  pick: (member: TeamMemberWeekRow) => { count: number; detail: string },
  ltFallbackKey?: string,
) {
  const fromMembers = aggregateFromMembers(reports, pick);
  if (fromMembers.value) return fromMembers;

  const teams = reports.filter((item) => item.reporterRole === "toTruong");
  const fromFields = teams
    .map((report) => report.fields?.[fieldKey]?.trim())
    .filter(Boolean)
    .join("; ");
  const sources = teams.filter((report) => report.fields?.[fieldKey]?.trim()).map((report) => slotLabel("toTruong", report.teamNumber));

  if (fromFields) return { value: fromFields, sources };

  if (ltFallbackKey) {
    const lt = findReport(reports, "lopTruong");
    const ltValue = lt?.fields?.[ltFallbackKey]?.trim();
    if (ltValue) return { value: ltValue, sources: ["LT"] };
  }

  return { value: "", sources: [] };
}

function line(label: string, value: string, sources: string[]): ReportLine {
  return { label, value: value || "Không có", sources };
}

function isEmptyReportValue(value: string) {
  const trimmed = value.trim();
  return !trimmed || trimmed === "Không có" || trimmed === "Chưa có" || trimmed === "Chưa đủ điểm";
}

function sumTeamCount(reports: WeeklyReport[], field: string) {
  return reports
    .filter((item) => item.reporterRole === "toTruong")
    .reduce((total, report) => total + toCount(report.fields?.[field]), 0);
}

function formatTeamTotalLine(total: number, names: string) {
  if (total > 0) {
    return names ? `${total} lượt (${names})` : `${total} lượt`;
  }
  return names || "";
}

function formatRankingText(ranking: GvcnWeekReport["ranking"]) {
  if (!ranking.firstPlace) return "";
  const topScore = ranking.scores[0]?.score;
  return topScore != null ? `${ranking.firstPlace} (${topScore} đ)` : ranking.firstPlace;
}

function formatViolationRow(entry: ViolationEntry) {
  const detail = entry.detail ? `, ${entry.detail}` : "";
  return `   · ${entry.studentName}: ${entry.kindLabel} ${entry.count} lượt${detail}`;
}

function buildCleanReportText(
  weekNumber: number,
  shortRange: string,
  sections: ReportSection[],
  violations: ViolationEntry[],
) {
  const textLines = [`BÁO CÁO SINH HOẠT TUẦN ${weekNumber}${shortRange ? ` (${shortRange})` : ""}`, "", "I. TÌNH HÌNH HỌC SINH", ""];

  for (const section of sections) {
    const lines = section.lines.filter((item) => !isEmptyReportValue(item.value));
    if (!lines.length) continue;
    textLines.push(section.title, ...lines.map((item) => `   - ${item.label}: ${item.value}`), "");
  }

  if (violations.length) {
    textLines.push("II. CHI TIẾT VI PHẠM THEO HỌC SINH", "", ...violations.map(formatViolationRow));
  }

  return textLines.join("\n").trim();
}

export function buildGvcnWeekReport(input: {
  weekNumber: number;
  dateRangeLabel?: string;
  reports: WeeklyReport[];
}): GvcnWeekReport {
  const { weekNumber, dateRangeLabel, reports } = input;
  const lt = findReport(reports, "lopTruong");
  const lpht = findReport(reports, "lopPhoHocTap");
  const lptt = findReport(reports, "lopPhoTratTu");
  const lpld = findReport(reports, "lopPhoLaoDong");
  const lppt = findReport(reports, "lopPhoPhongTrao");
  const thuQuy = findReport(reports, "thuQuy");
  const teams = reports.filter((item) => item.reporterRole === "toTruong");
  const ranking = getTeamScoresForWeek(reports, weekNumber);
  const violations = collectViolationsFromTeams(reports);
  const shortRange = rangeShort(dateRangeLabel);

  const absent = mergeFieldAndMembers(reports, "absent_names", (m) => ({ count: m.absentCount, detail: m.absentDates }), "absent_student");
  const late = mergeFieldAndMembers(reports, "late_names", (m) => ({ count: m.lateCount, detail: m.lateDates }), "late_student");
  const notPrepared = mergeFieldAndMembers(reports, "not_prepared_names", (m) => ({
    count: m.notPreparedCount,
    detail: m.notPreparedSubjects,
  }));
  const noHomework = mergeFieldAndMembers(reports, "no_homework_names", (m) => ({ count: m.noHomeworkCount, detail: "" }));
  const disorderMembers = mergeFieldAndMembers(reports, "disorder_names", (m) => ({ count: m.disorderCount, detail: "" }));
  const violationMembers = mergeFieldAndMembers(reports, "violation_names", (m) => ({
    count: m.violationCount,
    detail: m.violationDetail,
  }));
  const goodPoints = mergeFieldAndMembers(reports, "good_points_names", (m) => ({ count: m.goodPointsCount, detail: "" }));
  const participation = mergeFieldAndMembers(reports, "participation_names", (m) => ({ count: m.participationCount, detail: "" }));
  const goodPointsTotal = sumTeamCount(reports, "good_points_count");
  const participationTotal = sumTeamCount(reports, "participation_count");

  const guildViolation = text(lt?.fields, "violation_guild");
  const guildSources = lt?.fields?.violation_guild?.trim() ? ["LT"] : [];

  const expenses = [1, 2, 3, 4, 5, 6]
    .map((index) => {
      const name = thuQuy?.fields?.[`expense_name_${index}`]?.trim();
      const amount = thuQuy?.fields?.[`expense_amount_${index}`]?.trim();
      if (!name && !amount) return "";
      return `${name || "Chi"}: ${amount || "0"}`;
    })
    .filter(Boolean)
    .join(", ");

  const sections: ReportSection[] = [
    {
      id: "thi-dua",
      title: "1. Thi đua tổ",
      lines: [
        line(
          "Hạng nhất",
          formatRankingText(ranking) || "Chưa đủ điểm",
          teams.map((t) => slotLabel("toTruong", t.teamNumber)).filter(Boolean) as string[],
        ),
      ],
    },
    {
      id: "hoc-tap",
      title: "2. Học tập",
      lines: [
        line(
          "Tổng điểm tốt",
          formatTeamTotalLine(goodPointsTotal, goodPoints.value),
          goodPoints.sources.length ? goodPoints.sources : teams.map((t) => slotLabel("toTruong", t.teamNumber)).filter(Boolean) as string[],
        ),
        line(
          "Tổng phát biểu",
          formatTeamTotalLine(participationTotal, participation.value),
          participation.sources.length ? participation.sources : teams.map((t) => slotLabel("toTruong", t.teamNumber)).filter(Boolean) as string[],
        ),
        line("Thái độ học tập tuần qua", text(lpht?.fields, "study_attitude", ""), lpht ? ["LPHT"] : []),
        line("Lý do", text(lpht?.fields, "study_attitude_reason", ""), lpht ? ["LPHT"] : []),
        line("Phương hướng tuần sau", text(lpht?.fields, "future_plan", ""), lpht ? ["LPHT"] : []),
        line("Đề xuất tuần sau", text(lpht?.fields, "suggestions", ""), lpht ? ["LPHT"] : []),
        line("Không thuộc bài", notPrepared.value, notPrepared.sources),
        line("Không BTVN", noHomework.value, noHomework.sources),
      ],
    },
    {
      id: "trat-tu",
      title: "3. Trật tự & vi phạm",
      lines: [
        line("Mất trật tự (tổ)", disorderMembers.value, disorderMembers.sources),
        line("Vi phạm Đoàn (tổ)", violationMembers.value, violationMembers.sources),
        line("Chưa ghi SDB (LPTT)", text(lptt?.fields, "disorder_not_sdb"), lptt ? ["LPTT"] : []),
        line("Đã ghi SDB (LPTT)", text(lptt?.fields, "disorder_sdb"), lptt ? ["LPTT"] : []),
        line("Vi phạm bên Đoàn (LT)", guildViolation, guildSources),
      ],
    },
    {
      id: "di-hoc",
      title: "4. Đi học đúng giờ",
      lines: [
        line("Vắng", absent.value, absent.sources),
        line("Đi trễ", late.value, late.sources),
      ],
    },
    {
      id: "lao-dong",
      title: "5. Lao động",
      lines: [
        line("Tổ trực vệ sinh", text(lpld?.fields, "cleaning_team"), lpld ? ["LPLD"] : []),
        line("Ý kiến phản hồi", text(lpld?.fields, "feedback"), lpld ? ["LPLD"] : []),
      ],
    },
    {
      id: "phong-trao",
      title: "6. Phong trào",
      lines: [
        line("Tên phong trào", text(lppt?.fields, "campaign_name"), lppt ? ["LPPT"] : []),
        line("Thời gian", text(lppt?.fields, "implementation_time"), lppt ? ["LPPT"] : []),
        line("Tiến độ", text(lppt?.fields, "progress"), lppt ? ["LPPT"] : []),
        line("HS phụ trách", text(lppt?.fields, "assigned_students"), lppt ? ["LPPT"] : []),
      ],
    },
    {
      id: "quy-lop",
      title: "7. Quỹ lớp",
      lines: [
        line("Tổng thu", text(thuQuy?.fields, "total_income", "Chưa có"), thuQuy ? ["Thủ quỹ"] : []),
        line("Tổng chi", `${text(thuQuy?.fields, "total_expense", "Chưa có")}${expenses ? ` (${expenses})` : ""}`, thuQuy ? ["Thủ quỹ"] : []),
        line("Còn lại", text(thuQuy?.fields, "remaining", "Chưa có"), thuQuy ? ["Thủ quỹ"] : []),
      ],
    },
    {
      id: "gvcn",
      title: "8. GVCN",
      lines: [
        line("Thông báo Đoàn", text(lt?.fields, "notice_guild"), lt ? ["LT"] : []),
        line("Phương hướng tuần sau", text(lt?.fields, "future_plan"), lt ? ["LT"] : []),
      ],
    },
  ];

  const officerSources: OfficerSource[] = OFFICER_SLOTS.map((slot) => ({
    key: slot.key,
    label: slot.label,
    role: slot.role,
    teamNumber: slot.teamNumber,
    submitted: reports.some(
      (item) => item.reporterRole === slot.role && (slot.teamNumber == null ? item.teamNumber == null : item.teamNumber === slot.teamNumber),
    ),
  }));

  return {
    title: `Báo cáo sinh hoạt tuần ${weekNumber}`,
    dateRange: dateRangeLabel ?? "",
    text: buildCleanReportText(weekNumber, shortRange, sections, violations),
    sections,
    violations,
    officerSources,
    ranking,
  };
}

export function assembleGvcnSummary(input: {
  weekNumber: number;
  dateRangeLabel?: string;
  reports: WeeklyReport[];
}) {
  return buildGvcnWeekReport(input).text;
}
