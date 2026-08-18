"use client";

import type { RefObject } from "react";

import type { ReportField } from "@/lib/report-fields";

import { reportFieldLines, type SavedReport } from "@/components/officer/use-officer-reports";

export function SubmittedReportsList({
  reports,
  fields,
  hasMore,
  loadingMore,
  onLoadMore,
  highlightWeekNumber,
  showSuccessHighlight,
  sectionRef,
}: {
  reports: SavedReport[];
  fields: ReportField[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  highlightWeekNumber?: number;
  showSuccessHighlight?: boolean;
  sectionRef?: RefObject<HTMLElement | null>;
}) {
  if (!reports.length) return null;

  return (
    <section className="mt-6 space-y-3" ref={sectionRef}>
      <p className="text-center text-sm font-semibold text-slate-600">Báo cáo đã gửi</p>
      {reports.map((report) => {
        const lines = reportFieldLines(report, fields);
        return (
          <details
            className="rounded-xl bg-slate-50 p-4"
            key={report._id}
            open={showSuccessHighlight && report.weekNumber === highlightWeekNumber}
          >
            <summary className="cursor-pointer font-semibold">{report.weekLabel}</summary>
            <div className="mt-3 space-y-2 text-sm">
              {lines.length ? (
                lines.map((line) => (
                  <p key={line.key}>
                    <strong>{line.label}:</strong> {line.value}
                  </p>
                ))
              ) : (
                <p>Chưa có nội dung.</p>
              )}
            </div>
          </details>
        );
      })}
      {hasMore ? (
        <button className="button-secondary w-full" disabled={loadingMore} onClick={() => void onLoadMore()} type="button">
          {loadingMore ? "Đang tải…" : "Xem thêm"}
        </button>
      ) : null}
    </section>
  );
}
