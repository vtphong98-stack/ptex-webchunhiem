"use client";

import { useState, type RefObject } from "react";

import { formatCampaignCopyText, parseCampaignAssignments } from "@/lib/campaign-duty";
import { formatDisciplineCopyText, parseDisciplineRecords } from "@/lib/discipline-duty";
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

function DisciplineReportBody({ report }: { report: SavedReport }) {
  const [copied, setCopied] = useState(false);
  const dutyTeam = report.fields.duty_team || "";
  const socialMedia = report.fields.social_media || "";
  const rows = parseDisciplineRecords(report.fields.discipline_records_json).filter(
    (row) => row.incidentCount > 0 || row.subject.trim(),
  );
  const copyValue = formatDisciplineCopyText({
    weekLabel: report.weekLabel,
    dutyTeam,
    recordsRaw: report.fields.discipline_records_json,
    socialMedia,
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
          <strong>Tổ theo dõi:</strong> Tổ {dutyTeam.replace(/^Tổ\s*/i, "")}
        </p>
      ) : null}
      {rows.length ? (
        rows.map((row) => (
          <p key={`${row.studentId}-${row.fullName}`}>
            {row.fullName}
            {row.incidentCount > 0 ? `: ${row.incidentCount} lần` : ""}
            {row.subject.trim() ? ` · ${row.subject.trim()}` : ""}
          </p>
        ))
      ) : (
        <p>Chưa ghi nhận vi phạm.</p>
      )}
      {socialMedia.trim() ? (
        <p>
          <strong>Theo dõi mạng:</strong> {socialMedia.trim()}
        </p>
      ) : null}
      <button className="button-secondary labor-copy-btn" onClick={() => void handleCopy()} type="button">
        {copied ? "✓ Đã copy" : "Copy gửi Zalo"}
      </button>
    </div>
  );
}

function CampaignReportBody({ report }: { report: SavedReport }) {
  const [copied, setCopied] = useState(false);
  const campaignName = report.fields.campaign_name || "";
  const implementationTime = report.fields.implementation_time || "";
  const progress = report.fields.progress || "";
  const rows = parseCampaignAssignments(report.fields.campaign_assignments_json).filter((row) => row.assignment.trim());
  const copyValue = formatCampaignCopyText({
    weekLabel: report.weekLabel,
    campaignName,
    implementationTime,
    progress,
    assignmentsRaw: report.fields.campaign_assignments_json,
  });

  async function handleCopy() {
    await copyText(copyValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="labor-report-body">
      {campaignName.trim() ? (
        <p>
          <strong>Tên phong trào:</strong> {campaignName.trim()}
        </p>
      ) : null}
      {implementationTime.trim() ? (
        <p>
          <strong>Thời gian:</strong> {implementationTime.trim()}
        </p>
      ) : null}
      {progress.trim() ? (
        <p>
          <strong>Tiến độ:</strong> {progress.trim()}
        </p>
      ) : null}
      {rows.length ? (
        rows.map((row) => (
          <p key={`${row.studentId}-${row.fullName}`}>
            {row.fullName}: {row.assignment.trim()}
          </p>
        ))
      ) : (
        <p>Chưa phân công.</p>
      )}
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
  variant?: "default" | "labor" | "discipline" | "campaign";
}) {
  if (!reports.length) return null;

  function renderBody(report: SavedReport, lines: ReturnType<typeof reportFieldLines>) {
    if (variant === "labor" || report.fields.labor_assignments_json) {
      return <LaborReportBody report={report} />;
    }
    if (variant === "discipline" || report.fields.discipline_records_json) {
      return <DisciplineReportBody report={report} />;
    }
    if (variant === "campaign" || report.fields.campaign_assignments_json) {
      return <CampaignReportBody report={report} />;
    }
    if (lines.length) {
      return lines.map((line) => (
        <p key={line.key}>
          <strong>{line.label}:</strong> {line.value}
        </p>
      ));
    }
    return <p>Chưa có nội dung.</p>;
  }

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
            <div className="mt-3 space-y-2 text-sm">{renderBody(report, lines)}</div>
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
