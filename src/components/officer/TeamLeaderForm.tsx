"use client";

import { useEffect, useMemo, useState } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { emptyMemberRow, parseMemberRows, TEAM_ROLE_LABELS } from "@/lib/team-roster";
import type { ReportWriteMode, TeamRole } from "@/lib/types";
import { buildExcelWeeks } from "@/lib/weeks";

type TeamStudent = { _id: string; fullName: string; teamRole: TeamRole | null };
type SavedReport = {
  _id: string;
  weekNumber: number;
  weekLabel: string;
  fields: Record<string, string>;
  updatedAt: string;
};

const WRITE_MODES: Array<{ value: ReportWriteMode; label: string; hint: string }> = [
  { value: "create", label: "Ghi mới", hint: "Chỉ khi tuần này chưa có báo cáo. Tránh đè dữ liệu cũ." },
  { value: "append", label: "Bổ sung", hint: "Cộng dồn số lượt, thêm ngày/môn vào danh sách đã nộp." },
  { value: "edit", label: "Sửa", hint: "Thay toàn bộ nội dung tuần này bằng bảng đang thấy." },
];

export function TeamLeaderForm({
  fullName,
  teamNumber,
}: {
  fullName: string;
  teamNumber: number;
}) {
  const weeks = useMemo(() => buildExcelWeeks(), []);
  const [teamStudents, setTeamStudents] = useState<TeamStudent[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [weekNumber, setWeekNumber] = useState(1);
  const [writeMode, setWriteMode] = useState<ReportWriteMode | "">("");
  const [rows, setRows] = useState(teamStudents.map(emptyMemberRow));
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/officer/reports")
      .then((response) => response.json())
      .then((data) => {
        const students = (data.teamStudents ?? []) as TeamStudent[];
        const items = (data.reports ?? []) as SavedReport[];
        setTeamStudents(students);
        setReports(items);
        if (items[0]?.weekNumber) setWeekNumber(items[0].weekNumber);
      })
      .catch(() => setStatus("Chưa tải được danh sách tổ."));
  }, []);

  useEffect(() => {
    const current = reports.find((item) => item.weekNumber === weekNumber);
    const saved = parseMemberRows(current?.fields?.members_json);
    const byId = new Map(saved.map((row) => [row.studentId || row.fullName, row]));
    setRows(
      teamStudents.map((student) => {
        const blank = emptyMemberRow(student);
        return byId.get(student._id) ?? byId.get(student.fullName) ?? blank;
      }),
    );
    setWriteMode("");
    setStatus("");
  }, [teamStudents, reports, weekNumber]);

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
    if (!writeMode) {
      setStatus("Hãy chọn Ghi mới, Bổ sung hoặc Sửa trước khi gửi.");
      return;
    }
    setPending(true);
    setStatus("");
    const response = await fetch("/api/officer/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekNumber, writeMode, members: rows }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setStatus(data.error || "Không gửi được báo cáo.");
      return;
    }
    setStatus(
      writeMode === "append"
        ? "Đã bổ sung vào báo cáo tuần."
        : writeMode === "edit"
          ? "Đã sửa báo cáo tuần."
          : "Đã ghi mới báo cáo tuần.",
    );
    const refresh = await fetch("/api/officer/reports");
    const next = await refresh.json().catch(() => ({}));
    setReports(next.reports ?? reports);
  }

  return (
    <main className="py-6">
      <div className="officer-form officer-form-wide">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <a className="button-secondary" href="/">
            ← Trang chủ
          </a>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>
        <h1>Dành cho tổ trưởng tổ {teamNumber}</h1>
        <h2>{fullName}</h2>

        {!teamStudents.length ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            Tổ chưa có danh sách học sinh. GVCN hãy tải mẫu Excel 4 tổ, gõ tên rồi import trên trang chủ nhiệm.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="weekNumber">TUẦN THỨ</label>
              <select
                id="weekNumber"
                onChange={(event) => setWeekNumber(Number(event.target.value))}
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

            <fieldset className="write-mode">
              <legend>Cách ghi dữ liệu (bắt buộc)</legend>
              {WRITE_MODES.map((mode) => (
                <label className={writeMode === mode.value ? "active" : ""} key={mode.value}>
                  <input
                    checked={writeMode === mode.value}
                    name="writeMode"
                    onChange={() => setWriteMode(mode.value)}
                    type="radio"
                    value={mode.value}
                  />
                  <span>
                    <strong>{mode.label}</strong>
                    <em>{mode.hint}</em>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="team-sheet">
              <table>
                <thead>
                  <tr>
                    <th>Học sinh</th>
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
                      <td className="name-cell">
                        <strong>{row.fullName}</strong>
                        <span>
                          {index === 0 || row.teamRole === "toTruong"
                            ? TEAM_ROLE_LABELS.toTruong
                            : index === 1 || row.teamRole === "toPho"
                              ? TEAM_ROLE_LABELS.toPho
                              : TEAM_ROLE_LABELS.thanhVien}
                        </span>
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
            <button className="button-primary w-full" disabled={pending} onClick={() => submit()} type="button">
              {pending ? "Đang gửi…" : "Gửi dữ liệu tổ"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
