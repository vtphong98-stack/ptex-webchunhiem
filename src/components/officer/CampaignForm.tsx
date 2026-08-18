"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction, saveReportAction } from "@/app/dashboard/actions";
import { SubmittedReportsList } from "@/components/officer/SubmittedReportsList";
import { useOfficerReports } from "@/components/officer/use-officer-reports";
import {
  alignCampaignRows,
  emptyCampaignRows,
  parseCampaignAssignments,
  type CampaignAssignmentRow,
} from "@/lib/campaign-duty";
import { flattenTeamRosters, type RosterStudent } from "@/lib/officer-roster";
import { getReportFields } from "@/lib/report-fields";
import { buildExcelWeeks } from "@/lib/weeks";

export function CampaignForm({ fullName }: { fullName: string }) {
  const weeks = useMemo(() => buildExcelWeeks(), []);
  const reportFields = useMemo(() => getReportFields("lopPhoPhongTrao"), []);
  const { reports, hasMore, loadingMore, loadInitial, refresh, loadMore } = useOfficerReports();
  const [schoolYearId, setSchoolYearId] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [rows, setRows] = useState<CampaignAssignmentRow[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [implementationTime, setImplementationTime] = useState("");
  const [progress, setProgress] = useState("");
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
      if (reportData?.reports[0]?.weekNumber) setWeekNumber(reportData.reports[0].weekNumber);
    });
  }, [loadInitial, loadTeamRosters]);

  useEffect(() => {
    if (!students.length) {
      setRows([]);
      return;
    }
    const current = reports.find((item) => item.weekNumber === weekNumber);
    if (current?.fields?.campaign_assignments_json) {
      setRows(alignCampaignRows(students, parseCampaignAssignments(current.fields.campaign_assignments_json)));
    } else {
      setRows(emptyCampaignRows(students));
    }
    setCampaignName(current?.fields?.campaign_name ?? "");
    setImplementationTime(current?.fields?.implementation_time ?? "");
    setProgress(current?.fields?.progress ?? "");
  }, [students, reports, weekNumber]);

  function updateRow(index: number, value: string) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, assignment: value } : row)));
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
        <h1>Dành cho lớp phó phong trào (LPPT)</h1>
        <h2>{fullName}</h2>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <input name="schoolYearId" type="hidden" value={schoolYearId} />
          <input name="campaign_assignments_json" type="hidden" value={JSON.stringify(rows)} readOnly />

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
                  {week.label}
                  {week.dateRangeLabel ? ` · ${week.dateRangeLabel}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="campaign_name">Tên phong trào</label>
            <input
              id="campaign_name"
              name="campaign_name"
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="Ví dụ: Hội thi văn nghệ"
              value={campaignName}
            />
          </div>

          <div>
            <label htmlFor="implementation_time">Thời gian thực hiện</label>
            <input
              id="implementation_time"
              name="implementation_time"
              onChange={(event) => setImplementationTime(event.target.value)}
              placeholder="Ví dụ: Tuần 25–27"
              value={implementationTime}
            />
          </div>

          <div>
            <label htmlFor="progress">Tiến độ</label>
            <input
              id="progress"
              name="progress"
              onChange={(event) => setProgress(event.target.value)}
              placeholder="Ví dụ: Đang tập luyện"
              value={progress}
            />
          </div>

          {loadingRoster ? (
            <p className="labor-hint">Đang tải danh sách lớp…</p>
          ) : !students.length ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Chưa có danh sách học sinh. GVCN kiểm tra phân tổ trên trang chủ nhiệm.
            </p>
          ) : (
            <div className="labor-sheet">
              <table>
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Nội dung phân công</th>
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
                          onChange={(event) => updateRow(index, event.target.value)}
                          placeholder="Nhiệm vụ phụ trách"
                          value={row.assignment}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
          variant="campaign"
        />
      </div>
    </main>
  );
}
