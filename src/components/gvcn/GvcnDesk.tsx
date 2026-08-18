"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { GvcnWeekReportView } from "@/components/gvcn/GvcnWeekReport";
import { TeamManager } from "@/components/gvcn/TeamManager";
import { CLASS_SITE } from "@/lib/class-site";
import type { GvcnWeekReport } from "@/lib/gvcn-report";
import { OFFICER_SLOTS } from "@/lib/report-fields";
import { buildExcelWeeks } from "@/lib/weeks";

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

export function GvcnDesk({ fullName }: { fullName: string }) {
  const [board, setBoard] = useState<{ rows: BoardRow[] }>({ rows: emptyBoardRows() });
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<WeekDetailData | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [deskView, setDeskView] = useState<"weeks" | "teams">("weeks");
  const weekCache = useRef(new Map<number, WeekDetailData>());

  useEffect(() => {
    fetch("/api/gvcn/board")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data.rows) && data.rows.length) {
          setBoard({ rows: data.rows });
        }
      })
      .catch(() => setBoardError("Chưa tải được trạng thái nộp. Vẫn chọn tuần bình thường."));
  }, []);

  const fetchWeek = useCallback(async (weekNumber: number) => {
    const response = await fetch(`/api/gvcn/week/${weekNumber}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<WeekDetailData>;
  }, []);

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

  return (
    <div className="container py-4 md:py-6">
      <header className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-slate-500">{CLASS_SITE.fullName}</p>
          <h1 className="text-xl font-bold text-slate-950">
            {deskView === "teams" ? "Quản lý tổ" : "Tổng kết tuần"} · {fullName}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            className={deskView === "weeks" ? "button-primary" : "button-secondary"}
            onClick={() => setDeskView("weeks")}
            type="button"
          >
            Tổng kết tuần
          </button>
          <button
            className={deskView === "teams" ? "button-primary" : "button-secondary"}
            onClick={() => setDeskView("teams")}
            type="button"
          >
            Quản lý tổ
          </button>
          <a className="button-secondary" href="/">
            Trang chủ
          </a>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>

      {deskView === "teams" ? (
        <TeamManager />
      ) : (
        <>
      {boardError ? <p className="mb-3 text-sm text-amber-700">{boardError}</p> : null}

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Chọn tuần</h2>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-10">
          {board.rows.map((row) => {
              const hasData = row.submitted > 0;
              const active = row.weekNumber === selectedWeek;
              return (
                <button
                  className={`rounded-xl border-2 px-2 py-2 text-center text-xs font-bold ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700"
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
                    {hasData ? `${row.submitted}/${row.total}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

      {selectedWeek ? (
        <section className="card mt-4 overflow-hidden">
          <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
            <div>
              <h3 className="text-lg font-bold">
                {weekDetail?.weekMeta?.label ?? `Tuần ${selectedWeek}`}
                {weekDetail?.weekMeta?.dateRangeLabel ? ` · ${weekDetail.weekMeta.dateRangeLabel}` : ""}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                {weekDetail?.ranking?.firstPlace ? `${weekDetail.ranking.firstPlace} hạng nhất` : "Chi tiết báo cáo tuần"}
              </p>
            </div>
            <button className="button-secondary" onClick={() => setSelectedWeek(null)} type="button">
              Đóng
            </button>
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
