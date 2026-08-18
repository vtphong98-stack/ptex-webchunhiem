"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { fetchBoardData, fetchWeekDetail } from "@/lib/gvcn-actions";
import { OFFICER_SLOTS } from "@/lib/report-fields";
import { formatDate, formatRoleLabel } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────

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
  ranking: { firstPlace: string; scores: Array<{ teamNumber: number; score: number }> } | null;
  weekMeta: { label?: string; dateRangeLabel?: string } | null;
}

// ─── Component ────────────────────────────────────────────

export function GvcnDashboard({ yearId }: { yearId: string }) {
  const [board, setBoard] = useState<{ rows: BoardRow[]; weeksWithReports: number[] } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<WeekDetailData | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Fetch board data on mount via server action
  useEffect(() => {
    setLoadingBoard(true);
    startTransition(async () => {
      try {
        const data = await fetchBoardData(yearId);
        setBoard(data);
      } finally {
        setLoadingBoard(false);
      }
    });
  }, [yearId]);

  // Fetch week detail via server action
  const openWeek = useCallback((wn: number) => {
    setSelectedWeek(wn);
    setWeekDetail(null);
    startTransition(async () => {
      try {
        const data = await fetchWeekDetail(wn, yearId);
        setWeekDetail(data);
      } catch { /* ignore */ }
    });
  }, [yearId]);

  const closeWeek = useCallback(() => {
    setSelectedWeek(null);
    setWeekDetail(null);
  }, []);

  const loadingWeek = isPending && selectedWeek !== null && weekDetail === null;

  return (
    <div className="space-y-4">
      {/* Board loading skeleton */}
      {loadingBoard ? (
        <section className="card p-5">
          <div className="mb-4 h-6 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-10">
            {Array.from({ length: 35 }, (_, i) => (
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" key={i} />
            ))}
          </div>
        </section>
      ) : board ? (
        <>
          {/* Week chip grid */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">📊 Tổng kết báo cáo</h3>
              <span className="text-sm text-slate-500">
                {board.weeksWithReports.length} / {board.rows.length} tuần có dữ liệu
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-10">
              {board.rows.map((row) => {
                const hasData = row.submitted > 0;
                const isActive = row.weekNumber === selectedWeek;
                const pct = row.total > 0 ? Math.round((row.submitted / row.total) * 100) : 0;
                return (
                  <button
                    className={`relative flex flex-col items-center rounded-xl border-2 px-2 py-2 text-center transition-all ${
                      isActive
                        ? "border-blue-600 bg-blue-50 shadow-md shadow-blue-100"
                        : hasData
                          ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:shadow-sm"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                    key={row.weekNumber}
                    onClick={() => openWeek(row.weekNumber)}
                    type="button"
                  >
                    <span className={`text-xs font-bold ${isActive ? "text-blue-700" : hasData ? "text-emerald-700" : "text-slate-400"}`}>
                      T{row.weekNumber}
                    </span>
                    {hasData ? (
                      <>
                        <span className={`mt-0.5 text-[10px] font-medium ${isActive ? "text-blue-600" : "text-emerald-600"}`}>
                          {pct}%
                        </span>
                        {row.firstPlace ? (
                          <span className="mt-0.5 text-[9px] text-amber-600 font-semibold truncate w-full">
                            🏆 {row.firstPlace}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="mt-0.5 text-[10px] text-slate-300">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Status table (collapsible) */}
          <details className="card">
            <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-blue-600">
              📋 Xem bảng chi tiết theo chức vụ
            </summary>
            <div className="week-board px-5 pb-5">
              <table>
                <thead>
                  <tr>
                    <th>Tuần</th>
                    {OFFICER_SLOTS.map((s) => <th key={s.key}>{s.label}</th>)}
                    <th>Hạng nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((row) => (
                    <tr
                      key={row.weekNumber}
                      onClick={() => openWeek(row.weekNumber)}
                      style={{ cursor: "pointer", ...(row.weekNumber === selectedWeek ? { outline: "2px solid #2563eb", outlineOffset: -1 } : {}) }}
                    >
                      <td className="font-medium text-blue-600">{row.label}</td>
                      {OFFICER_SLOTS.map((s) => {
                        const k = `${s.role}|${s.teamNumber ?? ""}`;
                        const ok = row.cells[k] ?? false;
                        return <td className={ok ? "week-ok" : "week-missing"} key={`${row.weekNumber}-${s.key}`}>{ok ? "Có" : "—"}</td>;
                      })}
                      <td>{row.firstPlace || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : null}

      {/* Week detail panel */}
      {selectedWeek ? (
        <section className="card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white">
            <div>
              <h3 className="text-lg font-bold">
                {weekDetail?.weekMeta?.label ?? `Tuần ${selectedWeek}`}
                {weekDetail?.weekMeta?.dateRangeLabel ? ` · ${weekDetail.weekMeta.dateRangeLabel}` : ""}
              </h3>
              {weekDetail?.ranking?.firstPlace ? (
                <p className="mt-1 text-sm text-blue-100">🏆 {weekDetail.ranking.firstPlace} hạng nhất · {weekDetail.reports.length} báo cáo</p>
              ) : (
                <p className="mt-1 text-sm text-blue-200">{weekDetail ? `${weekDetail.reports.length} báo cáo` : "Đang tải..."}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedWeek > 1 ? (
                <button
                  className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
                  onClick={() => openWeek(selectedWeek - 1)}
                  type="button"
                >
                  ← T{selectedWeek - 1}
                </button>
              ) : null}
              {board && selectedWeek < board.rows.length ? (
                <button
                  className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
                  onClick={() => openWeek(selectedWeek + 1)}
                  type="button"
                >
                  T{selectedWeek + 1} →
                </button>
              ) : null}
              <button
                className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
                onClick={closeWeek}
                type="button"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            {loadingWeek ? (
              <div className="space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : weekDetail && weekDetail.reports.length > 0 ? (
              <>
                {/* Scores */}
                {weekDetail.ranking?.scores?.length ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {weekDetail.ranking.scores.map((s) => (
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          weekDetail.ranking?.firstPlace?.includes(`Tổ ${s.teamNumber}`)
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                        key={s.teamNumber}
                      >
                        Tổ {s.teamNumber}: {s.score}đ
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Summary */}
                <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                  {weekDetail.summary}
                </pre>

                {/* Per-officer detail */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-blue-600">
                    📝 Chi tiết từng chức vụ ({weekDetail.reports.length} báo cáo)
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {weekDetail.reports.map((report) => (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4" key={report._id}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatRoleLabel(report.reporterRole)}
                            {report.teamNumber ? ` · Tổ ${report.teamNumber}` : ""}
                          </p>
                          <span className="text-[11px] text-slate-400">{formatDate(report.updatedAt)}</span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          {report.fieldDefs.map((field) => {
                            const value = report.fields[field.name];
                            if (!value) return null;
                            return (
                              <p key={field.name}>
                                <strong className="text-slate-500">{field.label}:</strong> {value}
                              </p>
                            );
                          })}
                          {report.fields.team_score ? (
                            <p className="font-semibold text-emerald-700">Điểm tổ: {report.fields.team_score}</p>
                          ) : null}
                          {report.fields.remaining ? (
                            <p className="font-semibold text-blue-700">Quỹ còn lại: {report.fields.remaining}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </>
            ) : weekDetail ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Tuần {selectedWeek} chưa có báo cáo nào.
              </p>
            ) : null}
          </div>
        </section>
      ) : board && !loadingBoard ? (
        <section className="card p-8 text-center">
          <p className="text-4xl">👆</p>
          <p className="mt-3 text-sm text-slate-500">Chọn tuần ở trên để xem chi tiết báo cáo</p>
        </section>
      ) : null}
    </div>
  );
}
