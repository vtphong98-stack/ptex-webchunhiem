"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction, saveReportAction } from "@/app/dashboard/actions";
import { SubmittedReportsList } from "@/components/officer/SubmittedReportsList";
import { WeekLockBanner, weekOptionLabel } from "@/components/officer/WeekLockBanner";
import { useOfficerReports } from "@/components/officer/use-officer-reports";
import { flattenTeamRosters, type RosterStudent } from "@/lib/officer-roster";
import { getReportFields } from "@/lib/report-fields";
import {
  alignPaymentRows,
  computeTreasuryLedger,
  emptyPaymentRows,
  emptyTreasuryLine,
  formatVnd,
  parsePaymentRows,
  parseTreasuryLines,
  parseVnd,
  type TreasuryLine,
  type TreasuryPaymentRow,
} from "@/lib/treasury-duty";
import { buildExcelWeeks, getCurrentRealtimeWeekNumber } from "@/lib/weeks";
import { findLock, pickDefaultOfficerWeek } from "@/lib/week-lock";

function paidRowsFromStudents(students: RosterStudent[], saved?: TreasuryPaymentRow[]) {
  return alignPaymentRows(students, saved ?? emptyPaymentRows(students)).map((row) => ({
    ...row,
    paidText: row.paidAmount > 0 ? String(row.paidAmount) : "",
  }));
}

function linesOrBlank(raw: unknown): TreasuryLine[] {
  const parsed = parseTreasuryLines(raw);
  return parsed.length ? parsed : [emptyTreasuryLine()];
}

export function TreasuryForm({ fullName }: { fullName: string }) {
  const weeks = useMemo(() => buildExcelWeeks(), []);
  const reportFields = useMemo(() => getReportFields("thuQuy"), []);
  const { reports, hasMore, loadingMore, loadInitial, refresh, loadMore, treasuryPreviousByWeek, weekLocks } = useOfficerReports();
  const [schoolYearId, setSchoolYearId] = useState("");
  const [weekNumber, setWeekNumber] = useState(() => getCurrentRealtimeWeekNumber(weeks));
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [rows, setRows] = useState<Array<TreasuryPaymentRow & { paidText: string }>>([]);
  const [feeText, setFeeText] = useState("");
  const [rewards, setRewards] = useState<TreasuryLine[]>([emptyTreasuryLine()]);
  const [expenses, setExpenses] = useState<TreasuryLine[]>([emptyTreasuryLine()]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const reportsRef = useRef<HTMLElement>(null);
  const weekLock = findLock(weekLocks, weekNumber);

  const loadTeamRosters = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const response = await fetch("/api/officer/team-rosters");
      if (!response.ok) throw new Error("fetch_failed");
      const data = await response.json();
      setStudents(flattenTeamRosters((data.teams ?? {}) as Record<string, RosterStudent[]>));
      if (data.schoolYearId) setSchoolYearId(data.schoolYearId);
    } catch {
      setStudents([]);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadInitial(), loadTeamRosters()]).then(([reportData]) => {
      if (reportData?.schoolYearId) setSchoolYearId(reportData.schoolYearId);
      setWeekNumber(pickDefaultOfficerWeek(reportData?.weekLocks ?? []));
    });
  }, [loadInitial, loadTeamRosters]);

  useEffect(() => {
    const current = reports.find((item) => item.weekNumber === weekNumber);
    if (!students.length) {
      setRows([]);
    } else if (current?.fields?.treasury_payments_json) {
      setRows(paidRowsFromStudents(students, parsePaymentRows(current.fields.treasury_payments_json)));
    } else {
      setRows(paidRowsFromStudents(students));
    }
    setFeeText(current?.fields?.fee_per_student && Number(current.fields.fee_per_student) > 0 ? current.fields.fee_per_student : "");
    setRewards(linesOrBlank(current?.fields?.treasury_rewards_json));
    setExpenses(linesOrBlank(current?.fields?.treasury_expenses_json));
  }, [students, reports, weekNumber]);

  const paymentPayload = useMemo(
    () => rows.map(({ studentId, fullName, paidText }) => ({ studentId, fullName, paidAmount: parseVnd(paidText) })),
    [rows],
  );
  const previousRemaining = treasuryPreviousByWeek[String(weekNumber)] ?? 0;
  const ledger = useMemo(
    () =>
      computeTreasuryLedger(
        {
          treasury_payments_json: JSON.stringify(paymentPayload),
          treasury_rewards_json: JSON.stringify(rewards),
          treasury_expenses_json: JSON.stringify(expenses),
          fee_per_student: feeText,
        },
        previousRemaining,
      ),
    [paymentPayload, rewards, expenses, feeText, previousRemaining],
  );

  function applyFeeToAll() {
    const amount = parseVnd(feeText);
    if (amount <= 0) return;
    const text = String(amount);
    setRows((current) => current.map((row) => ({ ...row, paidAmount: amount, paidText: text })));
  }

  function updateLine(
    setter: typeof setRewards,
    index: number,
    key: "amount" | "reason",
    value: string,
  ) {
    setter((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        return key === "amount" ? { ...line, amount: parseVnd(value) } : { ...line, reason: value };
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const result = await saveReportAction(new FormData(event.currentTarget));
      if (result && result.ok === false) {
        setErrorMessage(result.error);
        return;
      }
      const data = await refresh();
      if (data?.schoolYearId) setSchoolYearId(data.schoolYearId);
      setSuccessMessage("Báo cáo thành công");
      requestAnimationFrame(() => {
        reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      setErrorMessage("Không gửi được báo cáo. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="py-6">
      <div className="officer-form officer-form-wide labor-form">
        <div className="tt-form-toolbar">
          <Link className="button-secondary" href="/">
            ← Trang chủ
          </Link>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>
        <h1>Dành cho thủ quỹ</h1>
        <h2>{fullName}</h2>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <input name="schoolYearId" type="hidden" value={schoolYearId} />
          <input name="fee_per_student" type="hidden" value={String(parseVnd(feeText) || ledger.feePerStudent)} readOnly />
          <input name="treasury_payments_json" type="hidden" value={JSON.stringify(paymentPayload)} readOnly />
          <input name="treasury_rewards_json" type="hidden" value={JSON.stringify(rewards)} readOnly />
          <input name="treasury_expenses_json" type="hidden" value={JSON.stringify(expenses)} readOnly />

          <div>
            <label htmlFor="weekNumber">TUẦN THỨ</label>
            <select
              id="weekNumber"
              name="weekNumber"
              onChange={(event) => {
                setWeekNumber(Number(event.target.value));
                setSuccessMessage("");
              }}
              value={weekNumber}
            >
              {weeks.map((week) => (
                <option key={week.weekNumber} value={week.weekNumber}>
                  {weekOptionLabel(week, findLock(weekLocks, week.weekNumber))}
                </option>
              ))}
            </select>
          </div>
          <WeekLockBanner lock={weekLock} />
          <fieldset className="space-y-4" disabled={weekLock.locked}>

          <div className="treasury-apply">
            <div>
              <label htmlFor="fee_apply">Số tiền đóng</label>
              <input
                id="fee_apply"
                inputMode="numeric"
                onChange={(event) => setFeeText(event.target.value)}
                placeholder="Ví dụ: 10000"
                value={feeText}
              />
            </div>
            <button className="button-secondary" onClick={applyFeeToAll} type="button">
              Áp dụng tất cả
            </button>
          </div>
          <p className="labor-hint">Học sinh không nộp: xoá ô tiền đóng (để trống) → vào danh sách thiếu quỹ.</p>

          {loadingRoster ? (
            <p className="labor-hint">Đang tải danh sách lớp…</p>
          ) : !students.length ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Chưa có danh sách học sinh. GVCN kiểm tra phân tổ trên trang chủ nhiệm.
            </p>
          ) : (
            <div className="labor-sheet treasury-sheet">
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Tên học sinh</th>
                    <th>Tiền đóng</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.studentId || row.fullName}>
                      <td className="stt-cell">{index + 1}</td>
                      <td className="name-cell">
                        <strong>{row.fullName}</strong>
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          onChange={(event) => {
                            const paidText = event.target.value;
                            setRows((current) =>
                              current.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, paidText, paidAmount: parseVnd(paidText) } : item,
                              ),
                            );
                          }}
                          placeholder="Trống = thiếu"
                          value={row.paidText}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="treasury-missing">
            <p>
              <strong>Thiếu quỹ ({ledger.missingCount}):</strong>{" "}
              {ledger.missingStudents.length ? ledger.missingStudents.join(", ") : "Không có"}
            </p>
          </div>

          <TreasuryLineList
            lines={rewards}
            onAdd={() => setRewards((current) => [...current, emptyTreasuryLine()])}
            onChange={(index, key, value) => updateLine(setRewards, index, key, value)}
            onRemove={(index) =>
              setRewards((current) => (current.length <= 1 ? [emptyTreasuryLine()] : current.filter((_, i) => i !== index)))
            }
            reasonLabel="Lý do thưởng"
            title="Tiền thưởng"
          />

          <TreasuryLineList
            lines={expenses}
            onAdd={() => setExpenses((current) => [...current, emptyTreasuryLine()])}
            onChange={(index, key, value) => updateLine(setExpenses, index, key, value)}
            onRemove={(index) =>
              setExpenses((current) => (current.length <= 1 ? [emptyTreasuryLine()] : current.filter((_, i) => i !== index)))
            }
            reasonLabel="Lý do chi"
            title="Tiền chi"
          />

          <div className="treasury-ledger">
            <p>
              Tồn tuần trước: <strong>{formatVnd(ledger.previousRemaining)} đ</strong>
            </p>
            <p>
              Tổng thu: <strong>{formatVnd(ledger.income)} đ</strong> ({ledger.paidCount} HS nộp)
            </p>
            <p>
              Tổng thưởng: <strong>{formatVnd(ledger.rewardTotal)} đ</strong>
            </p>
            <p>
              Tổng chi: <strong>{formatVnd(ledger.expenseTotal)} đ</strong>
            </p>
            <p className="treasury-remaining">
              Còn lại: <strong>{formatVnd(ledger.remaining)} đ</strong>
            </p>
            <p className="labor-hint">
              {formatVnd(ledger.previousRemaining)} + {formatVnd(ledger.income)} − {formatVnd(ledger.rewardTotal)} −{" "}
              {formatVnd(ledger.expenseTotal)} = {formatVnd(ledger.remaining)}
            </p>
          </div>

          <button className="button-primary w-full" disabled={pending || loadingRoster || weekLock.locked} type="submit">
            {pending ? "Đang gửi…" : weekLock.locked ? "Tuần đã khóa" : "Gửi dữ liệu"}
          </button>
          </fieldset>
        </form>

        {successMessage ? (
          <p className="success-note" role="status">
            {successMessage}
          </p>
        ) : null}
        {errorMessage ? <p className="status-note">{errorMessage}</p> : null}

        <SubmittedReportsList
          fields={reportFields}
          hasMore={hasMore}
          highlightWeekNumber={weekNumber}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          reports={reports}
          sectionRef={reportsRef}
          showSuccessHighlight={Boolean(successMessage)}
          variant="treasury"
        />
      </div>
    </main>
  );
}

function TreasuryLineList({
  title,
  reasonLabel,
  lines,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  reasonLabel: string;
  lines: TreasuryLine[];
  onChange: (index: number, key: "amount" | "reason", value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="treasury-lines">
      <p className="treasury-lines-title">{title}</p>
      {lines.map((line, index) => (
        <div className="treasury-line-card" key={line.id}>
          <div className="treasury-line-head">
            <span className="treasury-line-label">
              {title} · dòng {index + 1}
            </span>
            {lines.length > 1 ? (
              <button
                aria-label={`Xóa ${title.toLowerCase()} dòng ${index + 1}`}
                className="treasury-remove-btn"
                onClick={() => onRemove(index)}
                type="button"
              >
                Xóa dòng
              </button>
            ) : null}
          </div>
          <div className="treasury-line-row">
            <div>
              <label className="treasury-field-label">Số tiền</label>
              <input
                inputMode="numeric"
                onChange={(event) => onChange(index, "amount", event.target.value)}
                placeholder="0"
                value={line.amount > 0 ? String(line.amount) : ""}
              />
            </div>
            <div>
              <label className="treasury-field-label">{reasonLabel}</label>
              <input
                onChange={(event) => onChange(index, "reason", event.target.value)}
                placeholder={reasonLabel}
                value={line.reason}
              />
            </div>
          </div>
        </div>
      ))}
      <button className="button-secondary treasury-add-btn" onClick={onAdd} type="button">
        + Thêm {title.toLowerCase()}
      </button>
    </div>
  );
}
