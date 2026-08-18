import { alignRowsByStudents, type RosterStudent } from "@/lib/officer-roster";

export type TreasuryPaymentRow = {
  studentId: string;
  fullName: string;
  paidAmount: number;
};

export type TreasuryLine = {
  id: string;
  amount: number;
  reason: string;
};

export type TreasuryLedger = {
  previousRemaining: number;
  income: number;
  rewardTotal: number;
  expenseTotal: number;
  remaining: number;
  paidCount: number;
  missingCount: number;
  missingStudents: string[];
  feePerStudent: number;
};

const MAX_VND = Number.MAX_SAFE_INTEGER;

/** Parse VND as integer đồng. "10.000" / "10,000" / "10000" → 10000. Never use floats. */
export function parseVnd(value: unknown, allowNegative = false): number {
  if (value == null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const digits = raw.replace(/[^\d-]/g, "");
  if (!digits || digits === "-") return 0;
  const parsed = Number(digits);
  if (!Number.isSafeInteger(parsed)) return 0;
  return allowNegative ? parsed : Math.max(0, parsed);
}

export function parseSignedVnd(value: unknown) {
  return parseVnd(value, true);
}

export function formatVnd(value: number): string {
  const amount = Number.isFinite(value) ? Math.trunc(value) : 0;
  return amount.toLocaleString("vi-VN");
}

export function emptyPaymentRows(students: RosterStudent[]): TreasuryPaymentRow[] {
  return students.map((student) => ({
    studentId: student._id,
    fullName: student.fullName,
    paidAmount: 0,
  }));
}

export function parsePaymentRows(raw: unknown): TreasuryPaymentRow[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        studentId: String(item?.studentId ?? ""),
        fullName: String(item?.fullName ?? "").trim(),
        paidAmount: parseVnd(item?.paidAmount),
      }))
      .filter((item) => item.fullName);
  } catch {
    return [];
  }
}

export function alignPaymentRows(students: RosterStudent[], saved: TreasuryPaymentRow[]) {
  return alignRowsByStudents(students, saved, (student) => ({
    studentId: student._id,
    fullName: student.fullName,
    paidAmount: 0,
  }));
}

export function emptyTreasuryLine(): TreasuryLine {
  return { id: crypto.randomUUID(), amount: 0, reason: "" };
}

export function parseTreasuryLines(raw: unknown): TreasuryLine[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => ({
        id: String(item?.id ?? "") || `line-${index}`,
        amount: parseVnd(item?.amount),
        reason: String(item?.reason ?? "").trim(),
      }))
      .filter((item) => item.amount > 0 || item.reason);
  } catch {
    return [];
  }
}

function sumAmounts(values: number[]) {
  let total = 0;
  for (const value of values) {
    const amount = Math.max(0, Math.trunc(value) || 0);
    if (total > MAX_VND - amount) return MAX_VND;
    total += amount;
  }
  return total;
}

function mostCommonPaidAmount(payments: TreasuryPaymentRow[]) {
  const counts = new Map<number, number>();
  for (const row of payments) {
    if (row.paidAmount <= 0) continue;
    counts.set(row.paidAmount, (counts.get(row.paidAmount) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [amount, count] of counts) {
    if (count > bestCount || (count === bestCount && amount > best)) {
      best = amount;
      bestCount = count;
    }
  }
  return best;
}

function legacyExpenseTotal(fields: Record<string, string>) {
  return sumAmounts([1, 2, 3, 4, 5, 6].map((index) => parseVnd(fields[`expense_amount_${index}`])));
}

/**
 * Quỹ cộng dồn:
 * remaining(w) = remaining(tuần trước đã nộp) + thu(w) − thưởng(w) − chi(w)
 * Tất cả là số nguyên đồng. Thưởng và chi là tiền ra.
 */
export function computeTreasuryLedger(
  fields: Record<string, string>,
  previousRemaining = 0,
): TreasuryLedger {
  const previous = Number.isSafeInteger(Math.trunc(previousRemaining)) ? Math.trunc(previousRemaining) : 0;
  const payments = parsePaymentRows(fields.treasury_payments_json);
  const hasLedger = Boolean(fields.treasury_payments_json || fields.treasury_rewards_json || fields.treasury_expenses_json);

  const income = hasLedger
    ? sumAmounts(payments.map((row) => row.paidAmount))
    : parseVnd(fields.fee_per_student) * parseVnd(fields.quantity_paid);
  const rewards = parseTreasuryLines(fields.treasury_rewards_json);
  const expenses = parseTreasuryLines(fields.treasury_expenses_json);
  const rewardTotal = sumAmounts(rewards.map((row) => row.amount));
  const expenseTotal = hasLedger ? sumAmounts(expenses.map((row) => row.amount)) : legacyExpenseTotal(fields);
  const remaining = previous + income - rewardTotal - expenseTotal;
  const missing = payments.filter((row) => row.paidAmount <= 0);

  return {
    previousRemaining: previous,
    income,
    rewardTotal,
    expenseTotal,
    remaining,
    paidCount: payments.filter((row) => row.paidAmount > 0).length,
    missingCount: hasLedger ? missing.length : parseVnd(fields.quantity_missing),
    missingStudents: hasLedger
      ? missing.map((row) => row.fullName)
      : String(fields.missing_students ?? "")
          .split(/[,\n;]+/)
          .map((name) => name.trim())
          .filter(Boolean),
    feePerStudent: hasLedger ? mostCommonPaidAmount(payments) : parseVnd(fields.fee_per_student),
  };
}

export function applyTreasuryLedger(fields: Record<string, string>, ledger: TreasuryLedger) {
  const next = { ...fields };
  const hasLedger = Boolean(fields.treasury_payments_json || fields.treasury_rewards_json || fields.treasury_expenses_json);
  const expenses = parseTreasuryLines(fields.treasury_expenses_json);
  const rewards = parseTreasuryLines(fields.treasury_rewards_json);

  next.previous_remaining = String(ledger.previousRemaining);
  next.total_income = String(ledger.income);
  next.total_rewards = String(ledger.rewardTotal);
  next.total_expense = String(ledger.expenseTotal);
  next.remaining = String(ledger.remaining);

  if (!hasLedger) return next;

  next.fee_per_student = String(ledger.feePerStudent || parseVnd(fields.fee_per_student));
  next.quantity_paid = String(ledger.paidCount);
  next.quantity_missing = String(ledger.missingCount);
  next.missing_students = ledger.missingStudents.join(", ");
  next.treasury_rewards_summary = formatTreasuryLines(rewards, "Thưởng");
  next.treasury_expenses_summary = formatTreasuryLines(expenses, "Chi");

  for (let index = 1; index <= 6; index += 1) {
    const line = expenses[index - 1];
    next[`expense_name_${index}`] = line?.reason ?? "";
    next[`expense_amount_${index}`] = line ? String(line.amount) : "";
  }

  return next;
}

export function formatTreasuryLines(lines: TreasuryLine[], fallbackLabel: string) {
  const filled = lines.filter((line) => line.amount > 0 || line.reason);
  if (!filled.length) return "";
  return filled
    .map((line) => {
      const label = line.reason || fallbackLabel;
      return line.amount > 0 ? `- ${label}: ${formatVnd(line.amount)} đ` : `- ${label}`;
    })
    .join("\n");
}

export function formatPaidStudents(raw: unknown) {
  const rows = parsePaymentRows(raw).filter((row) => row.paidAmount > 0);
  if (!rows.length) return "";
  return rows.map((row) => `- ${row.fullName}: ${formatVnd(row.paidAmount)} đ`).join("\n");
}

export function previousRemainingFromChain(
  reports: Array<{ weekNumber: number; remaining: number }>,
  weekNumber: number,
) {
  const prior = reports
    .filter((item) => item.weekNumber < weekNumber)
    .sort((a, b) => b.weekNumber - a.weekNumber)[0];
  return prior?.remaining ?? 0;
}

export function cascadeTreasuryFields(
  reports: Array<{ weekNumber: number; fields: Record<string, string> }>,
) {
  const sorted = [...reports].sort((a, b) => a.weekNumber - b.weekNumber);
  let carry = 0;
  return sorted.map((report) => {
    const ledger = computeTreasuryLedger(report.fields, carry);
    const fields = applyTreasuryLedger(report.fields, ledger);
    const changed =
      fields.remaining !== String(report.fields.remaining ?? "") ||
      fields.previous_remaining !== String(report.fields.previous_remaining ?? "");
    carry = ledger.remaining;
    return { weekNumber: report.weekNumber, fields, changed, ledger };
  });
}

export function formatTreasuryCopyText(input: {
  weekLabel: string;
  fields: Record<string, string>;
}) {
  const ledger = computeTreasuryLedger(input.fields, parseSignedVnd(input.fields.previous_remaining));
  const lines = [
    `QUỸ LỚP · ${input.weekLabel}`,
    `Tồn tuần trước: ${formatVnd(ledger.previousRemaining)} đ`,
    `Tổng thu: ${formatVnd(ledger.income)} đ (${ledger.paidCount} HS nộp)`,
  ];
  const rewards = formatTreasuryLines(parseTreasuryLines(input.fields.treasury_rewards_json), "Thưởng");
  const expenses = formatTreasuryLines(parseTreasuryLines(input.fields.treasury_expenses_json), "Chi");
  if (rewards) lines.push("", "Tiền thưởng:", rewards);
  if (expenses) lines.push("", "Tiền chi:", expenses);
  if (ledger.missingStudents.length) {
    lines.push("", `Thiếu quỹ (${ledger.missingCount}): ${ledger.missingStudents.join(", ")}`);
  }
  lines.push("", `Còn lại: ${formatVnd(ledger.remaining)} đ`);
  return lines.join("\n").trim();
}
