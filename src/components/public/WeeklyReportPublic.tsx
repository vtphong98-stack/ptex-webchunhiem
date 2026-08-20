"use client";

import { useCallback, useEffect, useState } from "react";

import { ClassBoards } from "@/components/home/ClassBoards";
import { GvcnWeekReportView } from "@/components/gvcn/GvcnWeekReport";
import type { HomeBoard } from "@/lib/home-board";
import { getCurrentRealtimeWeekNumber } from "@/lib/weeks";

type WeekInfo = { weekNumber: number; label: string; dateRange: string };

export function WeeklyReportPublic({
  board,
  weeks,
}: {
  board: HomeBoard;
  weeks: WeekInfo[];
}) {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekData, setWeekData] = useState<{ report: unknown; reports: unknown[]; weekMeta: unknown } | null>(null);
  const [loading, setLoading] = useState(false);

  const openWeek = useCallback(async (wn: number) => {
    setSelectedWeek(wn);
    setLoading(true);
    setWeekData(null);
    try {
      const r = await fetch(`/api/public/week/${wn}`);
      if (r.ok) {
        const d = await r.json();
        setWeekData(d);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const currentW = getCurrentRealtimeWeekNumber();
    void openWeek(currentW);
  }, [openWeek]);

  const weekInfo = weeks.find((w) => w.weekNumber === selectedWeek);

  return (
    <>
      {/* Podium + star students */}
      <ClassBoards board={board} />

      {/* Week selector */}
      <div className="tk-week-section">
        <h3 className="tk-week-title">Chọn tuần xem báo cáo</h3>
        <div className="tk-week-grid">
          {weeks.map((w) => {
            const active = w.weekNumber === selectedWeek;
            return (
              <button
                key={w.weekNumber}
                className={`tk-week-btn ${active ? "tk-week-active" : ""}`}
                onClick={() => void openWeek(w.weekNumber)}
              >
                T{w.weekNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected week detail */}
      {selectedWeek ? (
        <div className="tk-detail">
          <div className="tk-detail-header">
            <h3>{weekInfo?.label ?? `Tuần ${selectedWeek}`}</h3>
            {weekInfo?.dateRange ? <span>{weekInfo.dateRange}</span> : null}
            <button className="tk-close" onClick={() => setSelectedWeek(null)}>✕</button>
          </div>
          <div className="tk-detail-body">
            {loading ? (
              <p style={{ textAlign: "center", padding: 20, color: "#64748b" }}>Đang tải báo cáo…</p>
            ) : weekData?.report ? (
              <GvcnWeekReportView
                loading={false}
                report={weekData.report as Parameters<typeof GvcnWeekReportView>[0]["report"]}
                reports={(weekData.reports ?? []) as Parameters<typeof GvcnWeekReportView>[0]["reports"]}
              />
            ) : (
              <p style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>
                Tuần {selectedWeek} chưa có báo cáo.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p style={{ textAlign: "center", padding: 16, color: "#94a3b8", fontSize: 14 }}>
          Chọn một tuần để xem báo cáo chi tiết.
        </p>
      )}
    </>
  );
}
