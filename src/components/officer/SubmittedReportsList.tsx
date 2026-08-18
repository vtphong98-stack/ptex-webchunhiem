"use client";

import { useState, type RefObject } from "react";

import type { ReportField } from "@/lib/report-fields";
import { formatLaborCopyText, groupLaborAssignmentsByDay } from "@/lib/labor-duty";

import { reportFieldLines, type SavedReport } from "@/components/officer/use-officer-reports";

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

function LaborReportBody({ report }: { report: SavedReport }) {
  const [copied, setCopied] = useState(false);
  const groups = groupLaborAssignmentsByDay(report.fields.labor_assignments_json);
  const dutyTeam = report.fields.duty_team || report.fields.cleaning_team?.replace(/^Tổ\s*/i, "") || "";
  const review = report.fields.labor_review || report.fields.feedback || "";
  const copyValue = formatLaborCopyText({
    weekLabel: report.weekLabel,
    dutyTeam,
    assignmentsRaw: report.fields.labor_assignments_json,
    review,
  });

  async function handleCopy() {
    await copyText(copyValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="labor-report-body">
      {dutyTeam ? (
        <p>
          <strong>Tổ trực:</strong> Tổ {dutyTeam.replace(/^Tổ\s*/i, "")}
        </p>
      ) : null}
      {groups.length ? (
        groups.map((group) => (
          <div className="labor-day-block" key={group.day}>
            <p className="labor-day-title">{group.label}:</p>
            {group.members.map((member) => (
              <p key={`${member.studentId}-${member.fullName}`}>{member.fullName}: {member.task}</p>
            ))}
          </div>
        ))
      ) : (
        <p>Chưa phân công.</p>
      )}
      {review.trim() ? (
        <p>
          <strong>Nhận xét:</strong> {review.trim()}
        </p>
      ) : null}
      <button className="button-secondary labor-copy-btn" onClick={() => void handleCopy()} type="button">
        {copied ? "✓ Đã copy" : "Copy gửi Zalo"}
      </button>
    </div>
  );
}

export function SubmittedReportsList({
  reports,
  fields,
  hasMore,
  loadingMore,
  onLoadMore,
  highlightWeekNumber,
  showSuccessHighlight,
  sectionRef,
  variant,
}: {
  reports: SavedReport[];
  fields: ReportField[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  highlightWeekNumber?: number;
  showSuccessHighlight?: boolean;
  sectionRef?: RefObject<HTMLElement | null>;
  variant?: "default" | "labor";
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
              {variant === "labor" || report.fields.labor_assignments_json ? (
                <LaborReportBody report={report} />
              ) : lines.length ? (
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
