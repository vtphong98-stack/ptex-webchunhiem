"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction, saveReportAction } from "@/app/dashboard/actions";
import { SubmittedReportsList } from "@/components/officer/SubmittedReportsList";
import { WeekLockBanner, weekOptionLabel } from "@/components/officer/WeekLockBanner";
import { useOfficerReports } from "@/components/officer/use-officer-reports";
import {
  alignLaborRows,
  applyLaborReuse,
  dutyTeamForWeek,
  emptyLaborRows,
  findLaborReuseSource,
  LABOR_DAYS,
  LABOR_TASKS,
  parseLaborAssignments,
  type LaborAssignmentRow,
  type LaborStudent,
} from "@/lib/labor-duty";
import { getReportFields } from "@/lib/report-fields";
import { buildExcelWeeks } from "@/lib/weeks";
import { findLock, pickDefaultOfficerWeek } from "@/lib/week-lock";

export function LaborForm({ fullName }: { fullName: string }) {
  const weeks = useMemo(() => buildExcelWeeks(), []);
  const reportFields = useMemo(() => getReportFields("lopPhoLaoDong"), []);
  const { reports, hasMore, loadingMore, loadInitial, refresh, loadMore, weekLocks } = useOfficerReports();
  const [schoolYearId, setSchoolYearId] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [dutyTeam, setDutyTeam] = useState(1);
  const [teamsByNumber, setTeamsByNumber] = useState<Record<string, LaborStudent[]>>({});
  const [students, setStudents] = useState<LaborStudent[]>([]);
  const [rows, setRows] = useState<LaborAssignmentRow[]>([]);
  const [review, setReview] = useState("");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState("");
  const reportsRef = useRef<HTMLElement>(null);
  const weekLock = findLock(weekLocks, weekNumber);

  const loadTeamRosters = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const response = await fetch("/api/officer/team-rosters");
      if (!response.ok) throw new Error("fetch_failed");
      const data = await response.json();
      const teams = (data.teams ?? {}) as Record<string, LaborStudent[]>;
      setTeamsByNumber(teams);
      if (data.schoolYearId) setSchoolYearId(data.schoolYearId);
      return teams;
    } catch {
      setTeamsByNumber({});
      setStatus("Chưa tải được danh sách tổ.");
      return null;
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadInitial(), loadTeamRosters()]).then(([reportData]) => {
      if (reportData?.schoolYearId) setSchoolYearId(reportData.schoolYearId);
      const firstWeek = pickDefaultOfficerWeek(reportData?.weekLocks ?? [], reportData?.reports[0]?.weekNumber ?? 1);
      setWeekNumber(firstWeek);
      const saved = reportData?.reports.find((item) => item.weekNumber === firstWeek);
      setDutyTeam(saved?.fields?.duty_team ? Number(saved.fields.duty_team) : dutyTeamForWeek(firstWeek));
    });
  }, [loadInitial, loadTeamRosters]);

  useEffect(() => {
    setStudents(teamsByNumber[String(dutyTeam)] ?? []);
  }, [teamsByNumber, dutyTeam]);

  useEffect(() => {
    if (!students.length) {
      setRows([]);
      return;
    }
    const current = reports.find((item) => item.weekNumber === weekNumber);
    const savedTeam = Number(current?.fields?.duty_team || 0);
    if (current?.fields?.labor_assignments_json && savedTeam === dutyTeam) {
      setRows(alignLaborRows(students, parseLaborAssignments(current.fields.labor_assignments_json)));
    } else {
      setRows(emptyLaborRows(students));
    }
    setReview(current?.fields?.labor_review ?? current?.fields?.feedback ?? "");
    setStatus("");
  }, [students, reports, weekNumber, dutyTeam]);

  function handleWeekChange(nextWeek: number) {
    setWeekNumber(nextWeek);
    setSuccessMessage("");
    setErrorMessage("");
    const current = reports.find((item) => item.weekNumber === nextWeek);
    setDutyTeam(current?.fields?.duty_team ? Number(current.fields.duty_team) : dutyTeamForWeek(nextWeek));
  }

  function updateRow(index: number, key: "laborDay" | "task", value: string) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  async function handleReuse() {
    setStatus("");
    let source = findLaborReuseSource(reports, dutyTeam, weekNumber);
    if (!source) {
      const response = await fetch(
        `/api/officer/reports?reuseTeam=${dutyTeam}&beforeWeek=${weekNumber}`,
      );
      const data = await response.json().catch(() => ({}));
      if (data.reuseReport) {
        source = {
          weekNumber: data.reuseReport.weekNumber,
          weekLabel: data.reuseReport.weekLabel,
          fields: data.reuseReport.fields ?? {},
        };
      }
    }
    if (!source) {
      setStatus(`Chưa có phân công cũ cho tổ ${dutyTeam}.`);
      return;
    }
    setRows(applyLaborReuse(students, parseLaborAssignments(source.fields.labor_assignments_json)));
    setStatus(`Đã lấy phân công ${source.weekLabel}. Chỉnh sửa nếu cần rồi gửi.`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSuccessMessage("");
    setErrorMessage("");
    setStatus("");
    try {
      const formData = new FormData(event.currentTarget);
      const result = await saveReportAction(formData);
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

  const rotationHint = `Tuần ${weekNumber} · gợi ý tổ trực: Tổ ${dutyTeamForWeek(weekNumber)}`;

  return (
    <main className="py-6">
      <div className="officer-form officer-form-wide labor-form">
        <div className="tt-form-toolbar">
          <a className="button-secondary" href="/">
            ← Trang chủ
          </a>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>
        <h1>Dành cho lớp phó lao động (LPLD)</h1>
        <h2>{fullName}</h2>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <input name="schoolYearId" type="hidden" value={schoolYearId} />
          <input name="labor_assignments_json" type="hidden" value={JSON.stringify(rows)} readOnly />

          <div>
            <label htmlFor="weekNumber">TUẦN THỨ</label>
            <select
              id="weekNumber"
              name="weekNumber"
              onChange={(event) => handleWeekChange(Number(event.target.value))}
              value={weekNumber}
            >
              {weeks.map((week) => (
                <option key={week.weekNumber} value={week.weekNumber}>
                  {weekOptionLabel(week, findLock(weekLocks, week.weekNumber))}
                </option>
              ))}
            </select>
            <p className="labor-hint">{rotationHint}</p>
          </div>
          <WeekLockBanner lock={weekLock} />
          <fieldset className="space-y-4" disabled={weekLock.locked}>
          <div>
            <label htmlFor="duty_team">Tổ trực lao động</label>
            <select
              id="duty_team"
              name="duty_team"
              onChange={(event) => {
                setDutyTeam(Number(event.target.value));
                setSuccessMessage("");
                setStatus("");
              }}
              value={dutyTeam}
            >
              {[1, 2, 3, 4].map((team) => (
                <option key={team} value={team}>
                  Tổ {team}
                </option>
              ))}
            </select>
          </div>

          <div className="labor-toolbar">
            <button className="button-secondary labor-reuse-btn" onClick={() => void handleReuse()} type="button">
              Phân công lại
            </button>
            <span className="labor-hint">Lấy phân công lần trước của tổ {dutyTeam} để chỉnh nhanh</span>
          </div>

          {loadingRoster ? (
            <p className="labor-hint">Đang tải danh sách tổ {dutyTeam}…</p>
          ) : !students.length ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Tổ {dutyTeam} chưa có học sinh trong danh sách lớp. GVCN kiểm tra phân tổ trên trang chủ nhiệm.
            </p>
          ) : (
            <div className="labor-sheet">
              <table>
                <thead>
                  <tr>
                    <th className="sticky-col">Họ tên</th>
                    <th>Ngày LD</th>
                    <th>Công việc</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.studentId || row.fullName}>
                      <td className="name-cell sticky-col">
                        <strong>{row.fullName}</strong>
                      </td>
                      <td>
                        <select
                          onChange={(event) => updateRow(index, "laborDay", event.target.value)}
                          value={row.laborDay}
                        >
                          <option value="">—</option>
                          {LABOR_DAYS.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select onChange={(event) => updateRow(index, "task", event.target.value)} value={row.task}>
                          <option value="">—</option>
                          {LABOR_TASKS.map((task) => (
                            <option key={task} value={task}>
                              {task}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label htmlFor="labor_review">Nhận xét tình hình lao động tuần qua</label>
            <textarea
              id="labor_review"
              name="labor_review"
              onChange={(event) => setReview(event.target.value)}
              placeholder="Ví dụ: Tổ trực nhiệt tình, lớp sạch sẽ"
              rows={3}
              value={review}
            />
          </div>

          {status ? <p className="status-note">{status}</p> : null}
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
          variant="labor"
        />
      </div>
    </main>
  );
}
