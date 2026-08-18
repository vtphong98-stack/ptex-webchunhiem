import type { AppRole, WeeklyReport } from "@/lib/types";

/**
 * Column keys stored in weeklyReports.fields.
 * Names match 12c1cn.xlsx sheets (TT1–TT4, LT, LPHT, LPTT, LPLD, LPPT, ThuQuy).
 */
export const EXCEL_SHEETS = {
  TT1: { role: "toTruong" as AppRole, teamNumber: 1 },
  TT2: { role: "toTruong" as AppRole, teamNumber: 2 },
  TT3: { role: "toTruong" as AppRole, teamNumber: 3 },
  TT4: { role: "toTruong" as AppRole, teamNumber: 4 },
  LT: { role: "lopTruong" as AppRole, teamNumber: null },
  LPHT: { role: "lopPhoHocTap" as AppRole, teamNumber: null },
  LPTT: { role: "lopPhoTratTu" as AppRole, teamNumber: null },
  LPLD: { role: "lopPhoLaoDong" as AppRole, teamNumber: null },
  LPPT: { role: "lopPhoPhongTrao" as AppRole, teamNumber: null },
  ThuQuy: { role: "thuQuy" as AppRole, teamNumber: null },
  "Tổng kết GVCN": { role: "gvcn" as AppRole, teamNumber: null },
} as const;

export function toCount(value?: string | number | null) {
  if (value == null || value === "") return 0;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Sheet TT: S = 1000 - (D+F+H+J+L+N)*50 + P*50 + R*5 */
export function computeTeamScore(fields: Record<string, string>) {
  return (
    1000 -
    toCount(fields.not_prepared_count) * 50 -
    toCount(fields.no_homework_count) * 50 -
    toCount(fields.disorder_count) * 50 -
    toCount(fields.late_count) * 50 -
    toCount(fields.violation_count) * 50 -
    toCount(fields.absent_count) * 50 +
    toCount(fields.good_points_count) * 50 +
    toCount(fields.participation_count) * 5
  );
}

/** Sheet ThuQuy: S=C*D, T=H+J+L+N+P+R, U=S-T(+ previous U) */
export function computeTreasury(fields: Record<string, string>, previousRemaining = 0) {
  const totalIncome = toCount(fields.fee_per_student) * toCount(fields.quantity_paid);
  const totalExpense = [1, 2, 3, 4, 5, 6].reduce(
    (sum, index) => sum + toCount(fields[`expense_amount_${index}`]),
    0,
  );
  return {
    totalIncome,
    totalExpense,
    remaining: totalIncome - totalExpense + previousRemaining,
  };
}

export function computeRanking(scores: Array<{ teamNumber: number; score: number }>) {
  const filled = scores.filter((item) => Number.isFinite(item.score));
  if (!filled.length) {
    return { scores: filled, firstPlace: "", maxScore: 0 };
  }
  const maxScore = Math.max(...filled.map((item) => item.score));
  const firstPlace = filled
    .filter((item) => item.score === maxScore)
    .map((item) => `Tổ ${item.teamNumber}`)
    .join(", ");
  return { scores: filled, firstPlace, maxScore };
}

export function enrichReportFields(
  role: AppRole,
  fields: Record<string, string>,
  previousRemaining = 0,
) {
  const next = { ...fields };

  if (role === "toTruong" || role === "toPho") {
    next.team_score = String(computeTeamScore(next));
  }

  if (role === "thuQuy") {
    const treasury = computeTreasury(next, previousRemaining);
    next.total_income = String(treasury.totalIncome);
    next.total_expense = String(treasury.totalExpense);
    next.remaining = String(treasury.remaining);
  }

  return next;
}

export function reportHasContent(fields: Record<string, string> | undefined) {
  if (!fields) return false;
  return Object.entries(fields).some(([key, value]) => {
    if (key === "week_range" || key === "team_score" || key === "total_income" || key === "total_expense" || key === "remaining") {
      return false;
    }
    return String(value ?? "").trim() !== "";
  });
}

export function getTeamScoresForWeek(reports: WeeklyReport[], weekNumber: number) {
  const scores = [1, 2, 3, 4].map((teamNumber) => {
    const report = reports.find(
      (item) => item.weekNumber === weekNumber && item.reporterRole === "toTruong" && item.teamNumber === teamNumber,
    );
    const score = report ? computeTeamScore(report.fields ?? {}) : Number.NaN;
    return { teamNumber, score, submitted: Boolean(report) };
  });
  return computeRanking(scores.filter((item) => item.submitted).map((item) => ({ teamNumber: item.teamNumber, score: item.score })));
}

function text(fields: Record<string, string> | undefined, key: string, fallback = "Không có") {
  const value = fields?.[key]?.trim();
  return value || fallback;
}

function joinNames(reports: WeeklyReport[], key: string) {
  return reports
    .map((report) => report.fields?.[key]?.trim())
    .filter(Boolean)
    .join(", ");
}

export function assembleGvcnSummary(input: {
  weekNumber: number;
  dateRangeLabel?: string;
  reports: WeeklyReport[];
}) {
  const { weekNumber, dateRangeLabel, reports } = input;
  const lt = reports.find((item) => item.reporterRole === "lopTruong");
  const lpht = reports.find((item) => item.reporterRole === "lopPhoHocTap");
  const lptt = reports.find((item) => item.reporterRole === "lopPhoTratTu");
  const lpld = reports.find((item) => item.reporterRole === "lopPhoLaoDong");
  const lppt = reports.find((item) => item.reporterRole === "lopPhoPhongTrao");
  const thuQuy = reports.find((item) => item.reporterRole === "thuQuy");
  const teams = reports.filter((item) => item.reporterRole === "toTruong");
  const ranking = getTeamScoresForWeek(reports, weekNumber);
  const rangeShort = dateRangeLabel ? dateRangeLabel.replace(/^từ ngày\s+/i, "").replace(/\s+đến\s+/i, " – ") : "";

  const expenses = [1, 2, 3, 4, 5, 6]
    .map((index) => {
      const name = thuQuy?.fields?.[`expense_name_${index}`]?.trim();
      const amount = thuQuy?.fields?.[`expense_amount_${index}`]?.trim();
      if (!name && !amount) return "";
      return `${name || "Chi"}: ${amount || "0"}`;
    })
    .filter(Boolean)
    .join(", ");

  return [
    `BÁO CÁO SINH HOẠT TUẦN ${weekNumber}${rangeShort ? ` (${rangeShort})` : ""}`,
    "",
    "I. TÌNH HÌNH HỌC SINH",
    "",
    "1. Thi đua",
    ranking.firstPlace ? `   - ${ranking.firstPlace} đạt hạng nhất.` : "   - Chưa đủ điểm tổ để xếp hạng.",
    "",
    "2. Học tập",
    `   - Biểu dương học sinh điểm tốt: ${joinNames(teams, "good_points_names") || "Không có"}.`,
    `   - Biểu dương học sinh phát biểu: ${joinNames(teams, "participation_names") || "Không có"}.`,
    `   - Số điểm tốt: ${text(lpht?.fields, "good_points")}.`,
    `   - Số lượt phát biểu: ${text(lpht?.fields, "speaking")}.`,
    `   - Môn học bị giáo viên nhắc nhở: ${text(lpht?.fields, "teacher_reminded")}.`,
    "",
    "3. Trật tự",
    `   - Chưa ghi SDB: ${text(lptt?.fields, "disorder_not_sdb")}.`,
    `   - Đã ghi SDB: ${text(lptt?.fields, "disorder_sdb")}.`,
    "",
    "4. Lao động",
    `   - Tổ trực vệ sinh: ${text(lpld?.fields, "cleaning_team")}.`,
    `   - Ý kiến phản hồi: ${text(lpld?.fields, "feedback")}.`,
    "",
    "5. Đi học đúng giờ",
    `   - Vắng: ${text(lt?.fields, "absent_student")}.`,
    `   - Đi trễ: ${text(lt?.fields, "late_student")}.`,
    "",
    "6. Vi phạm bên đoàn",
    `   - ${text(lt?.fields, "violation_guild")}.`,
    "",
    "7. Phong trào",
    `   - Tên phong trào: ${text(lppt?.fields, "campaign_name")}.`,
    `   - Thời gian thực hiện: ${text(lppt?.fields, "implementation_time")}.`,
    `   - Tiến độ thực hiện: ${text(lppt?.fields, "progress")}.`,
    `   - Phân công học sinh phụ trách: ${text(lppt?.fields, "assigned_students")}.`,
    `   - Ngày thi: ${text(lppt?.fields, "competition_date")}.`,
    `   - Dự kiến kinh phí: ${text(lppt?.fields, "estimated_cost")}.`,
    "",
    "8. Quỹ lớp",
    `   - Tổng thu: ${text(thuQuy?.fields, "total_income", "Chưa có")}.`,
    `   - Tổng chi: ${text(thuQuy?.fields, "total_expense", "Chưa có")}${expenses ? ` (${expenses})` : ""}.`,
    `   - Còn lại: ${text(thuQuy?.fields, "remaining", "Chưa có")}.`,
    "",
    "II. CÔNG TÁC GIÁO VIÊN CHỦ NHIỆM",
    `   - Thông báo Đoàn: ${text(lt?.fields, "notice_guild")}.`,
    `   - Phương hướng tuần sau: ${text(lt?.fields, "future_plan")}.`,
  ].join("\n");
}
