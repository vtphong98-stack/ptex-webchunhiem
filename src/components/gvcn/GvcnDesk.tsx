"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { GvcnWeekReportView } from "@/components/gvcn/GvcnWeekReport";
import { NoticeBoard } from "@/components/gvcn/NoticeBoard";
import { StudentLookup } from "@/components/gvcn/StudentLookup";
import { TeamManager } from "@/components/gvcn/TeamManager";
import { TimetableUpload } from "@/components/gvcn/TimetableUpload";
import { CLASS_SITE } from "@/lib/class-site";
import type { GvcnWeekReport } from "@/lib/gvcn-report";
import { OFFICER_SLOTS } from "@/lib/report-fields";
import { buildExcelWeeks } from "@/lib/weeks";
import { findLock, type WeekLockState } from "@/lib/week-lock";

interface BoardRow {
  weekNumber: number;
  label: string;
  dateRange: string;
  cells: Record<string, boolean>;
  firstPlace: string;
  submitted: number;
  total: number;
}

interface WeekReport {
  _id: string;
  reporterRole: string;
  teamNumber: number | null;
  updatedAt: string;
  fields: Record<string, string>;
  fieldDefs: Array<{ name: string; label: string }>;
}

interface WeekDetailData {
  reports: WeekReport[];
  summary: string;
  report: GvcnWeekReport | null;
  ranking: { firstPlace: string; scores: Array<{ teamNumber: number; score: number }> } | null;
  weekMeta: { label?: string; dateRangeLabel?: string } | null;
}

function emptyBoardRows(): BoardRow[] {
  return buildExcelWeeks().map((week) => ({
    weekNumber: week.weekNumber,
    label: week.label,
    dateRange: week.dateRangeLabel ?? "",
    cells: {},
    firstPlace: "",
    submitted: 0,
    total: OFFICER_SLOTS.length,
  }));
}

type DeskView = "weeks" | "teams" | "lookup" | "timetable" | "notices";

function yearQs(yearName: string) {
  return yearName ? `?year=${encodeURIComponent(yearName)}` : "";
}

export function GvcnDesk({ fullName }: { fullName: string }) {
  const [board, setBoard] = useState<{ rows: BoardRow[] }>({ rows: emptyBoardRows() });
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<WeekDetailData | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [deskView, setDeskView] = useState<DeskView>("weeks");
  const [locks, setLocks] = useState<WeekLockState[]>([]);
  const [lockPending, setLockPending] = useState(false);
  const [lockError, setLockError] = useState("");
  const [yearName, setYearName] = useState("");
  const [years, setYears] = useState<Array<{ name: string; label: string; isCurrent: boolean }>>([]);
  const [isCurrentYear, setIsCurrentYear] = useState(true);
  const [className, setClassName] = useState(CLASS_SITE.className);
  const [classDraft, setClassDraft] = useState(CLASS_SITE.className);
  const [editingClass, setEditingClass] = useState(false);
  const [classPending, setClassPending] = useState(false);
  const weekCache = useRef(new Map<number, WeekDetailData>());

  useEffect(() => {
    weekCache.current.clear();
    setSelectedWeek(null);
    setWeekDetail(null);
    const qs = yearQs(yearName);
    fetch(`/api/gvcn/board${qs}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data.years) && data.years.length) setYears(data.years);
        if (typeof data.yearName === "string" && data.yearName && !yearName) setYearName(data.yearName);
        if (typeof data.isCurrent === "boolean") setIsCurrentYear(data.isCurrent);
        if (Array.isArray(data.rows) && data.rows.length) {
          setBoard({ rows: data.rows });
        }
      })
      .catch(() => setBoardError("Chưa tải được trạng thái nộp. Vẫn chọn tuần bình thường."));

    fetch(`/api/gvcn/class${qs}`)
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (typeof data?.className === "string" && data.className) {
          setClassName(data.className);
          setClassDraft(data.className);
        }
      })
      .catch(() => undefined);

    fetch(`/api/gvcn/week-locks${qs}`)
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.locks)) setLocks(data.locks);
      })
      .catch(() => undefined);
  }, [yearName]);

  const fetchWeek = useCallback(async (weekNumber: number) => {
    const response = await fetch(`/api/gvcn/week/${weekNumber}${yearQs(yearName)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<WeekDetailData>;
  }, [yearName]);

  const openWeek = useCallback(
    (weekNumber: number) => {
      setSelectedWeek(weekNumber);
      const cached = weekCache.current.get(weekNumber);
      if (cached) {
        setWeekDetail(cached);
        setLoadingWeek(false);
        return;
      }
      setWeekDetail(null);
      setLoadingWeek(true);
      fetchWeek(weekNumber)
        .then((data) => {
          weekCache.current.set(weekNumber, data);
          setWeekDetail(data);
        })
        .catch(() => setWeekDetail({ reports: [], summary: "", report: null, ranking: null, weekMeta: null }))
        .finally(() => setLoadingWeek(false));
    },
    [fetchWeek],
  );

  const prefetchWeek = useCallback(
    (weekNumber: number) => {
      if (weekCache.current.has(weekNumber)) return;
      void fetchWeek(weekNumber)
        .then((data) => weekCache.current.set(weekNumber, data))
        .catch(() => undefined);
    },
    [fetchWeek],
  );

  async function setWeekLock(action: "lock" | "unlock" | "auto") {
    if (!selectedWeek) return;
    setLockPending(true);
    setLockError("");
    try {
      const response = await fetch(`/api/gvcn/week-locks${yearQs(yearName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNumber: selectedWeek, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLockError(data.error || "Không đổi được khóa tuần.");
        return;
      }
      if (Array.isArray(data.locks)) setLocks(data.locks);
    } catch {
      setLockError("Không đổi được khóa tuần.");
    } finally {
      setLockPending(false);
    }
  }

  async function saveClassName() {
    const next = classDraft.trim().replace(/\s+/g, "");
    if (!next) return;
    setClassPending(true);
    try {
      const response = await fetch(`/api/gvcn/class${yearQs(yearName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBoardError(data.error || "Không đổi được tên lớp.");
        return;
      }
      setClassName(data.className || next);
      setClassDraft(data.className || next);
      setEditingClass(false);
    } finally {
      setClassPending(false);
    }
  }

  const selectedLock = selectedWeek ? findLock(locks, selectedWeek) : null;
  const classLabel = `Lớp ${className || CLASS_SITE.className} - ${yearName || CLASS_SITE.schoolYear}`;

  return (
    <div className="container gvcn-desk py-4 md:py-6">
      <header className="card gvcn-desk-header mb-4 p-4">
        <div>
          {editingClass && isCurrentYear ? (
            <div className="gvcn-class-edit">
              <input
                aria-label="Tên lớp"
                onChange={(event) => setClassDraft(event.target.value)}
                value={classDraft}
              />
              <button className="button-primary" disabled={classPending} onClick={() => void saveClassName()} type="button">
                {classPending ? "Đang lưu…" : "Lưu tên lớp"}
              </button>
              <button
                className="button-secondary"
                onClick={() => {
                  setClassDraft(className);
                  setEditingClass(false);
                }}
                type="button"
              >
                Hủy
              </button>
            </div>
          ) : (
            <p className="gvcn-class-line">
              <span>{classLabel}</span>
              {isCurrentYear ? (
                <button className="gvcn-class-edit-btn" onClick={() => setEditingClass(true)} type="button">
                  Sửa tên lớp
                </button>
              ) : null}
            </p>
          )}
          <h1 className="text-xl font-bold text-slate-950">
            {deskView === "teams"
              ? "Phân công ban cán sự"
              : deskView === "lookup"
                ? "Tra cứu học sinh"
                : deskView === "timetable"
                  ? "Thời khóa biểu"
                  : deskView === "notices"
                    ? "Thông báo GVCN"
                    : "Tổng kết tuần"}{" "}
            · {fullName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-500">
              Năm học
              <select
                className="gvcn-year-select ml-2 rounded-lg border border-slate-200 px-2 py-1"
                onChange={(event) => setYearName(event.target.value)}
                value={yearName}
              >
                {!years.length ? <option value="">Năm hiện hành</option> : null}
                {years.map((year) => (
                  <option key={year.name} value={year.name}>
                    {year.name}
                    {year.isCurrent ? " (hiện hành)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {!isCurrentYear ? <span className="text-xs font-semibold text-amber-700">Đang xem năm cũ — chỉ đọc</span> : null}
          </div>
        </div>
        <nav className="gvcn-nav">
          <button
            className={deskView === "notices" ? "button-primary" : "button-secondary"}
            onClick={() => setDeskView("notices")}
            type="button"
          >
            Thông báo
          </button>
          <button
            className={deskView === "weeks" ? "button-primary" : "button-secondary"}
            onClick={() => setDeskView("weeks")}
            type="button"
          >
            Tổng kết tuần
          </button>
          <button
            className={deskView === "lookup" ? "button-primary" : "button-secondary"}
            onClick={() => setDeskView("lookup")}
            type="button"
          >
            Tra cứu HS
          </button>
          <button
            className={deskView === "teams" ? "button-primary" : "button-secondary"}
            onClick={() => setDeskView("teams")}
            type="button"
          >
            Ban cán sự
          </button>
          <button
            className={deskView === "timetable" ? "button-primary" : "button-secondary"}
            onClick={() => setDeskView("timetable")}
            type="button"
          >
            TKB
          </button>
          <a className="button-secondary" href="/">
            Trang chủ
          </a>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Đăng xuất
            </button>
          </form>
        </nav>
      </header>

      {deskView === "notices" ? (
        <NoticeBoard readOnly={!isCurrentYear} yearName={yearName} />
      ) : deskView === "teams" ? (
        <TeamManager readOnly={!isCurrentYear} yearName={yearName} />
      ) : deskView === "lookup" ? (
        <StudentLookup yearName={yearName} />
      ) : deskView === "timetable" ? (
        <TimetableUpload readOnly={!isCurrentYear} yearName={yearName} />
      ) : (
        <>
      {boardError ? <p className="mb-3 text-sm text-amber-700">{boardError}</p> : null}

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Chọn tuần</h2>
        <p className="mb-3 text-sm text-slate-500">
          Khóa tự động lúc <strong>0h thứ 7</strong> (giờ Việt Nam) theo lịch tuần. Chỉ GVCN mới mở khóa được.
        </p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-10">
          {board.rows.map((row) => {
              const hasData = row.submitted > 0;
              const active = row.weekNumber === selectedWeek;
              const lock = findLock(locks, row.weekNumber);
              return (
                <button
                  className={`rounded-xl border-2 px-2 py-2 text-center text-xs font-bold ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : lock.locked
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                      : hasData
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                  key={row.weekNumber}
                  onClick={() => openWeek(row.weekNumber)}
                  onMouseEnter={() => prefetchWeek(row.weekNumber)}
                  type="button"
                >
                  T{row.weekNumber}
                  <span className="mt-1 block text-[10px] font-medium">
                    {lock.locked ? "Khóa" : hasData ? `${row.submitted}/${row.total}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

      {selectedWeek ? (
        <section className="card mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white">
            <div>
              <h3 className="text-lg font-bold">
                {weekDetail?.weekMeta?.label ?? `Tuần ${selectedWeek}`}
                {weekDetail?.weekMeta?.dateRangeLabel ? ` · ${weekDetail.weekMeta.dateRangeLabel}` : ""}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                {selectedLock?.locked
                  ? selectedLock.source === "auto"
                    ? `Đã khóa tự động (${selectedLock.lockAtLabel})`
                    : "GVCN đã khóa tuần này"
                  : selectedLock?.source === "unlocked"
                    ? "GVCN đã mở khóa — ban cán sự có thể sửa"
                    : selectedLock?.lockAtLabel
                      ? `Đang mở · tự khóa ${selectedLock.lockAtLabel}`
                      : weekDetail?.ranking?.firstPlace
                        ? `${weekDetail.ranking.firstPlace} hạng nhất`
                        : "Chi tiết báo cáo tuần"}
              </p>
              {lockError ? <p className="mt-1 text-sm text-rose-300">{lockError}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {isCurrentYear ? (
                selectedLock?.locked ? (
                  <button className="button-primary" disabled={lockPending} onClick={() => void setWeekLock("unlock")} type="button">
                    {lockPending ? "Đang mở…" : "Mở khóa tuần"}
                  </button>
                ) : (
                  <button className="button-secondary" disabled={lockPending} onClick={() => void setWeekLock("lock")} type="button">
                    {lockPending ? "Đang khóa…" : "Khóa tuần"}
                  </button>
                )
              ) : null}
              {isCurrentYear && selectedLock?.override ? (
                <button className="button-secondary" disabled={lockPending} onClick={() => void setWeekLock("auto")} type="button">
                  Theo lịch thứ 7 0h
                </button>
              ) : null}
              <button className="button-secondary" onClick={() => setSelectedWeek(null)} type="button">
                Đóng
              </button>
            </div>
          </div>
          <div className="p-5">
            {weekDetail?.reports?.length || loadingWeek ? (
              <GvcnWeekReportView loading={loadingWeek} report={weekDetail?.report ?? null} reports={weekDetail?.reports ?? []} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">Tuần {selectedWeek} chưa có báo cáo.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="card mt-4 p-8 text-center text-sm text-slate-500">Chọn một tuần để xem tổng kết.</section>
      )}

      {board.rows.length ? (
        <details className="card mt-4">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-blue-600">Bảng đủ/thiếu theo chức vụ</summary>
          <div className="week-board px-5 pb-5">
            <table>
              <thead>
                <tr>
                  <th>Tuần</th>
                  {OFFICER_SLOTS.map((slot) => (
                    <th key={slot.key}>{slot.label}</th>
                  ))}
                  <th>Hạng nhất</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((row) => (
                  <tr key={row.weekNumber} onClick={() => openWeek(row.weekNumber)} style={{ cursor: "pointer" }}>
                    <td>{row.label}</td>
                    {OFFICER_SLOTS.map((slot) => {
                      const ok = row.cells[`${slot.role}|${slot.teamNumber ?? ""}`] ?? false;
                      return (
                        <td className={ok ? "week-ok" : "week-missing"} key={`${row.weekNumber}-${slot.key}`}>
                          {ok ? "Có" : "—"}
                        </td>
                      );
                    })}
                    <td>{row.firstPlace || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
        </>
      )}
    </div>
  );
}
