import type { AppRole, WeeklyReport } from "@/lib/types";
import { summarizeCampaignAssignments } from "@/lib/campaign-duty";
import { summarizeDisciplineRecords } from "@/lib/discipline-duty";
import { summarizeLaborAssignments } from "@/lib/labor-duty";
import { applyTreasuryLedger, computeTreasuryLedger } from "@/lib/treasury-duty";

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

/** Sheet ThuQuy: remaining = tồn tuần trước + thu − thưởng − chi (số nguyên đồng). */
export function computeTreasury(fields: Record<string, string>, previousRemaining = 0) {
  const ledger = computeTreasuryLedger(fields, previousRemaining);
  return {
    totalIncome: ledger.income,
    totalExpense: ledger.expenseTotal,
    remaining: ledger.remaining,
    income: ledger.income,
    rewardTotal: ledger.rewardTotal,
    previousRemaining: ledger.previousRemaining,
    paidCount: ledger.paidCount,
    missingCount: ledger.missingCount,
    missingStudents: ledger.missingStudents,
    feePerStudent: ledger.feePerStudent,
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
    const ledger = computeTreasuryLedger(next, previousRemaining);
    Object.assign(next, applyTreasuryLedger(next, ledger));
  }

  if (role === "lopPhoLaoDong") {
    next.labor_assignments_summary = summarizeLaborAssignments(next.labor_assignments_json);
    if (next.duty_team?.trim()) {
      next.cleaning_team = `Tổ ${next.duty_team.trim()}`;
    }
  }

  if (role === "lopPhoTratTu") {
    next.discipline_records_summary = summarizeDisciplineRecords(next.discipline_records_json);
  }

  if (role === "lopPhoPhongTrao") {
    next.campaign_assignments_summary = summarizeCampaignAssignments(next.campaign_assignments_json);
  }

  return next;
}

export function reportHasContent(fields: Record<string, string> | undefined) {
  if (!fields) return false;
  return Object.entries(fields).some(([key, value]) => {
    if (key === "week_range" || key === "team_score" || key === "total_income" || key === "total_expense" || key === "total_rewards" || key === "remaining" || key === "previous_remaining" || key === "quantity_paid" || key === "quantity_missing") {
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

export { assembleGvcnSummary } from "@/lib/gvcn-report";
