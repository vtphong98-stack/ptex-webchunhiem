"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction, saveReportAction } from "@/app/dashboard/actions";
import { SubmittedReportsList } from "@/components/officer/SubmittedReportsList";
import { useOfficerReports } from "@/components/officer/use-officer-reports";
import {
  alignDisciplineRows,
  emptyDisciplineRows,
  parseDisciplineRecords,
  type DisciplineRecordRow,
} from "@/lib/discipline-duty";
import { dutyTeamForWeek } from "@/lib/labor-duty";
import type { RosterStudent } from "@/lib/officer-roster";
import { getReportFields } from "@/lib/report-fields";
import { buildExcelWeeks } from "@/lib/weeks";

export function DisciplineForm({ fullName }: { fullName: string }) {
  const weeks = useMemo(() => buildExcelWeeks(), []);
  const reportFields = useMemo(() => getReportFields("lopPhoTratTu"), []);
  const { reports, hasMore, loadingMore, loadInitial, refresh, loadMore } = useOfficerReports();
  const [schoolYearId, setSchoolYearId] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [dutyTeam, setDutyTeam] = useState(1);
  const [teamsByNumber, setTeamsByNumber] = useState<Record<string, RosterStudent[]>>({});
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [rows, setRows] = useState<DisciplineRecordRow[]>([]);
  const [socialMedia, setSocialMedia] = useState("");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const reportsRef = useRef<HTMLElement>(null);

  const loadTeamRosters = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const response = await fetch("/api/officer/team-rosters");
      if (!response.ok) throw new Error("fetch_failed");
      const data = await response.json();
      setTeamsByNumber((data.teams ?? {}) as Record<string, RosterStudent[]>);
      if (data.schoolYearId) setSchoolYearId(data.schoolYearId);
    } catch {
      setTeamsByNumber({});
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadInitial(), loadTeamRosters()]).then(([reportData]) => {
      if (reportData?.schoolYearId) setSchoolYearId(reportData.schoolYearId);
      const firstWeek = reportData?.reports[0]?.weekNumber ?? 1;
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
    if (current?.fields?.discipline_records_json && savedTeam === dutyTeam) {
      setRows(alignDisciplineRows(students, parseDisciplineRecords(current.fields.discipline_records_json)));
    } else {
      setRows(emptyDisciplineRows(students));
    }
    setSocialMedia(current?.fields?.social_media ?? "");
  }, [students, reports, weekNumber, dutyTeam]);

  function handleWeekChange(nextWeek: number) {
    setWeekNumber(nextWeek);
    setSuccessMessage("");
    setErrorMessage("");
    const current = reports.find((item) => item.weekNumber === nextWeek);
    setDutyTeam(current?.fields?.duty_team ? Number(current.fields.duty_team) : dutyTeamForWeek(nextWeek));
  }

  function updateRow(index: number, key: "incidentCount" | "subject", value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (key === "incidentCount") {
          const incidentCount = Math.max(0, Number(value) || 0);
          return { ...row, incidentCount: Number.isFinite(incidentCount) ? incidentCount : 0 };
        }
        return { ...row, subject: value };
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      await saveReportAction(new FormData(event.currentTarget));
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
          <a className="button-secondary" href="/">
            ← Trang chủ
          </a>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>
        <h1>Dành cho lớp phó trật tự (LPTT)</h1>
        <h2>{fullName}</h2>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <input name="schoolYearId" type="hidden" value={schoolYearId} />
          <input name="discipline_records_json" type="hidden" value={JSON.stringify(rows)} readOnly />

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
                  {week.label}
                  {week.dateRangeLabel ? ` · ${week.dateRangeLabel}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="duty_team">Tổ theo dõi</label>
            <select
              id="duty_team"
              name="duty_team"
              onChange={(event) => {
                setDutyTeam(Number(event.target.value));
                setSuccessMessage("");
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

          {loadingRoster ? (
            <p className="labor-hint">Đang tải danh sách tổ {dutyTeam}…</p>
          ) : !students.length ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Tổ {dutyTeam} chưa có học sinh trong danh sách lớp.
            </p>
          ) : (
            <div className="labor-sheet">
              <table>
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Số lần</th>
                    <th>Môn gì</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.studentId || row.fullName}>
                      <td className="name-cell">
                        <strong>{row.fullName}</strong>
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "incidentCount", event.target.value)}
                          type="number"
                          value={row.incidentCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          onChange={(event) => updateRow(index, "subject", event.target.value)}
                          placeholder="Toán, Văn, ..."
                          value={row.subject}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label htmlFor="social_media">Theo dõi các bài đăng trên mạng</label>
            <textarea
              id="social_media"
              name="social_media"
              onChange={(event) => setSocialMedia(event.target.value)}
              placeholder="Ghi chú theo dõi mạng xã hội tuần qua"
              rows={3}
              value={socialMedia}
            />
          </div>

          <button className="button-primary w-full" disabled={pending || loadingRoster} type="submit">
            {pending ? "Đang gửi…" : "Gửi dữ liệu"}
          </button>
        </form>

        {successMessage ? <p className="success-note" role="status">{successMessage}</p> : null}
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
          variant="discipline"
        />
      </div>
    </main>
  );
}
