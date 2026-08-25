"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { SubmittedReportsList } from "@/components/officer/SubmittedReportsList";
import { WeekLockBanner, weekOptionLabel } from "@/components/officer/WeekLockBanner";
import { useOfficerReports } from "@/components/officer/use-officer-reports";
import { getOfficerTitle, getReportFields } from "@/lib/report-fields";
import { emptyMemberRow, parseMemberRows, TEAM_ROLE_LABELS, type TeamMemberWeekRow } from "@/lib/team-roster";
import type { AppRole, TeamRole } from "@/lib/types";
import { buildExcelWeeks, getCurrentRealtimeWeekNumber } from "@/lib/weeks";
import { findLock, pickDefaultOfficerWeek } from "@/lib/week-lock";

type TeamStudent = { _id: string; fullName: string; teamRole: TeamRole | null };

function TeamSheetSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách tổ" className="tt-loading">
      <div className="tt-loading-head">
        <span className="tt-loading-spinner" />
        <p>Đang tải danh sách học sinh tổ…</p>
      </div>
      {Array.from({ length: 8 }, (_, index) => (
        <div className="tt-skeleton-row" key={index}>
          <div className="tt-skeleton tt-skeleton-name" />
          <div className="tt-skeleton tt-skeleton-input" />
          <div className="tt-skeleton tt-skeleton-input" />
          <div className="tt-skeleton tt-skeleton-input" />
        </div>
      ))}
    </div>
  );
}

function roleLabel(index: number, teamRole: TeamRole | null) {
  if (index === 0 || teamRole === "toTruong") return TEAM_ROLE_LABELS.toTruong;
  if (index === 1 || teamRole === "toPho") return TEAM_ROLE_LABELS.toPho;
  return TEAM_ROLE_LABELS.thanhVien;
}

export function TeamLeaderForm({
  fullName,
  role = "toTruong",
  teamNumber,
}: {
  fullName: string;
  role?: AppRole;
  teamNumber: number;
}) {
  const weeks = useMemo(() => buildExcelWeeks(), []);
  const reportFields = useMemo(() => getReportFields("toTruong"), []);
  const { reports, teamStudents, hasMore, loadingMore, loadInitial, refresh, loadMore, weekLocks } = useOfficerReports();
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [weekNumber, setWeekNumber] = useState(() => getCurrentRealtimeWeekNumber(weeks));
  const [rows, setRows] = useState<TeamMemberWeekRow[]>([]);
  const [status, setStatus] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pending, setPending] = useState(false);
  const reportsRef = useRef<HTMLElement>(null);
  const weekLock = findLock(weekLocks, weekNumber);

  const students = teamStudents as TeamStudent[];

  useEffect(() => {
    void loadInitial()
      .then((data) => {
        setWeekNumber(pickDefaultOfficerWeek(data?.weekLocks ?? []));
      })
      .catch(() => setStatus("Chưa tải được danh sách tổ."))
      .finally(() => setLoadingStudents(false));
  }, [loadInitial]);

  useEffect(() => {
    if (!students.length) {
      setRows([]);
      return;
    }
    const current = reports.find((item) => item.weekNumber === weekNumber);
    const saved = parseMemberRows(current?.fields?.members_json);
    const byId = new Map(saved.map((row) => [row.studentId || row.fullName, row]));
    setRows(
      students.map((student) => {
        const blank = emptyMemberRow(student);
        return byId.get(student._id) ?? byId.get(student.fullName) ?? blank;
      }),
    );
    setStatus("");
  }, [students, reports, weekNumber]);

  function updateRow(index: number, key: string, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const numeric = key.endsWith("Count") ? Number(value || 0) : undefined;
        return {
          ...row,
          [key]: numeric !== undefined && Number.isFinite(numeric) ? numeric : value,
        };
      }),
    );
  }

  async function submit() {
    if (weekLock.locked) {
      setStatus(weekLock.message);
      return;
    }
    setPending(true);
    setStatus("");
    setSuccessMessage("");
    const response = await fetch("/api/officer/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekNumber, members: rows }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setStatus(data.error || "Không gửi được báo cáo.");
      return;
    }
    await refresh();
    setSuccessMessage("Báo cáo thành công");
    requestAnimationFrame(() => {
      reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <main className="py-6">
      <div className="officer-form officer-form-wide">
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
        <h1>{getOfficerTitle(role, teamNumber)}</h1>
        <h2>{fullName}</h2>

        {loadingStudents ? (
          <TeamSheetSkeleton />
        ) : !students.length ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            Tổ chưa có danh sách học sinh. GVCN hãy tải mẫu Excel 4 tổ, gõ tên rồi import trên trang chủ nhiệm.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="weekNumber">TUẦN THỨ</label>
              <select
                id="weekNumber"
                onChange={(event) => {
                  setWeekNumber(Number(event.target.value));
                  setSuccessMessage("");
                  setStatus("");
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

            <p className="tt-scroll-hint">Kéo trong bảng — dòng tiêu đề và cột học sinh luôn cố định</p>

            <div className="team-sheet">
              <table>
                <thead>
                  <tr>
                    <th className="sticky-col">Học sinh</th>
                    <th>Nghỉ</th>
                    <th>Ngày nghỉ</th>
                    <th>Đi trễ</th>
                    <th>Ngày trễ</th>
                    <th>Không thuộc</th>
                    <th>Môn</th>
                    <th>Không BTVN</th>
                    <th>Mất TT</th>
                    <th>Vi phạm</th>
                    <th>Chi tiết VP</th>
                    <th>Điểm tốt</th>
                    <th>Phát biểu</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.studentId || row.fullName}>
                      <td className="name-cell sticky-col">
                        <strong>{row.fullName}</strong>
                        <span>{roleLabel(index, row.teamRole)}</span>
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "absentCount", event.target.value)}
                          type="number"
                          value={row.absentCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          onChange={(event) => updateRow(index, "absentDates", event.target.value)}
                          placeholder="12/8, 13/8"
                          value={row.absentDates}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "lateCount", event.target.value)}
                          type="number"
                          value={row.lateCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          onChange={(event) => updateRow(index, "lateDates", event.target.value)}
                          placeholder="12/8"
                          value={row.lateDates}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "notPreparedCount", event.target.value)}
                          type="number"
                          value={row.notPreparedCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          onChange={(event) => updateRow(index, "notPreparedSubjects", event.target.value)}
                          placeholder="Toán, Văn"
                          value={row.notPreparedSubjects}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "noHomeworkCount", event.target.value)}
                          type="number"
                          value={row.noHomeworkCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "disorderCount", event.target.value)}
                          type="number"
                          value={row.disorderCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "violationCount", event.target.value)}
                          type="number"
                          value={row.violationCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          onChange={(event) => updateRow(index, "violationDetail", event.target.value)}
                          placeholder="Đồng phục"
                          value={row.violationDetail}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "goodPointsCount", event.target.value)}
                          type="number"
                          value={row.goodPointsCount || ""}
                        />
                      </td>
                      <td>
                        <input
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateRow(index, "participationCount", event.target.value)}
                          type="number"
                          value={row.participationCount || ""}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {status ? <p className="status-note">{status}</p> : null}
            {successMessage ? (
              <p className="success-note" role="status">
                {successMessage}
              </p>
            ) : null}
            <button className="button-primary w-full tt-submit-btn" disabled={pending || weekLock.locked} onClick={() => void submit()} type="button">
              {pending ? "Đang gửi…" : weekLock.locked ? "Tuần đã khóa" : "Gửi dữ liệu"}
            </button>
            </fieldset>

            <SubmittedReportsList
              fields={reportFields}
              hasMore={hasMore}
              highlightWeekNumber={weekNumber}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              reports={reports}
              sectionRef={reportsRef}
              showSuccessHighlight={Boolean(successMessage)}
            />
          </>
        )}
      </div>
    </main>
  );
}
