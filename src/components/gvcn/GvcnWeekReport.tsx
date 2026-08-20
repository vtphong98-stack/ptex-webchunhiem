"use client";

import { useCallback, useState } from "react";

import { parseMemberRows, type TeamMemberWeekRow } from "@/lib/team-roster";
import { formatDate, formatRoleLabel } from "@/lib/utils";
import type { GvcnWeekReport, ViolationEntry } from "@/lib/gvcn-report";

type WeekReport = {
  _id: string;
  reporterRole: string;
  teamNumber: number | null;
  updatedAt: string;
  fields: Record<string, string>;
  fieldDefs: Array<{ name: string; label: string }>;
};

export function GvcnWeekReportView({
  report,
  reports,
  loading,
}: {
  report: GvcnWeekReport | null;
  reports: WeekReport[];
  loading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyReport = useCallback(async () => {
    if (!report?.text) return;
    try {
      await navigator.clipboard.writeText(report.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const area = document.createElement("textarea");
      area.value = report.text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [report?.text]);

  const downloadDoc = useCallback(() => {
    if (!report?.text) return;
    // Word opens an HTML payload served as .doc, so this needs no library.
    const escaped = report.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html =
      `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">` +
      `<title>${report.title}</title><style>body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.5}` +
      `pre{font-family:inherit;white-space:pre-wrap;margin:0}</style></head>` +
      `<body><pre>${escaped}</pre></body></html>`;
    const blob = new Blob([`﻿${html}`], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.title.replace(/[^\p{L}\p{N}]+/gu, "-")}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [report?.text, report?.title]);

  if (loading) {
    return <p className="gvcn-report-loading">Đang tổng hợp báo cáo chung…</p>;
  }

  if (!report) {
    return <p className="gvcn-report-empty">Chưa có dữ liệu báo cáo tuần.</p>;
  }

  const submittedCount = report.officerSources.filter((item) => item.submitted).length;

  return (
    <div className="gvcn-report">
      <div className="gvcn-report-toolbar">
        <div>
          <p className="gvcn-report-kicker">Báo cáo chung lớp · tổng hợp tự động</p>
          <p className="gvcn-report-meta">
            {submittedCount}/{report.officerSources.length} chức vụ đã nộp
            {report.ranking.firstPlace ? ` · ${report.ranking.firstPlace} hạng nhất` : ""}
          </p>
        </div>
        <div className="gvcn-report-actions">
          <button className="button-primary gvcn-copy-btn" onClick={() => void copyReport()} type="button">
            {copied ? "✓ Đã copy" : "Copy nội dung"}
          </button>
          <button className="button-secondary" onClick={downloadDoc} type="button">
            Tải .doc
          </button>
          <button className="button-secondary" onClick={() => window.print()} type="button">
            In / PDF
          </button>
        </div>
      </div>

      <div className="gvcn-source-strip">
        {report.officerSources.map((slot) => (
          <span className={slot.submitted ? "gvcn-source gvcn-source-ok" : "gvcn-source"} key={slot.key} title={formatRoleLabel(slot.role)}>
            {slot.label}
            {slot.submitted ? " ✓" : ""}
          </span>
        ))}
      </div>

      {report.ranking.scores.length ? (
        <div className="gvcn-ranking-row">
          {report.ranking.scores.map((score) => (
            <span className="gvcn-ranking-pill" key={score.teamNumber}>
              Tổ {score.teamNumber}: <strong>{score.score}</strong> đ
            </span>
          ))}
        </div>
      ) : null}

      <div className="gvcn-report-sections">
        {report.sections.map((section) => (
          <section className="gvcn-report-section" key={section.id}>
            <h4>{section.title}</h4>
            <dl>
              {section.lines.map((line) => (
                <div className="gvcn-report-line" key={line.label}>
                  <dt>{line.label}</dt>
                  <dd>
                    <span>{line.value}</span>
                    {line.sources.length ? (
                      <span className="gvcn-line-sources">{line.sources.join(" · ")}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {report.violations.length ? (
        <section className="gvcn-violations">
          <h4>Chi tiết vi phạm theo học sinh</h4>
          <p className="gvcn-violations-note">Theo báo cáo tổ trưởng</p>
          <div className="gvcn-violations-table-wrap">
            <table className="gvcn-violations-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Tổ</th>
                  <th>Loại</th>
                  <th>Lượt</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {report.violations.map((row, index) => (
                  <ViolationRow key={`${row.studentName}-${row.kind}-${index}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <details className="gvcn-officer-refs" open>
        <summary>Báo cáo gốc từng chức vụ ({reports.length}) · chỉ đọc</summary>
        <div className="gvcn-officer-grid">
          {reports.map((item) => (
            <article className="gvcn-officer-card" key={item._id}>
              <header>
                <strong>
                  {formatRoleLabel(item.reporterRole)}
                  {item.teamNumber ? ` · Tổ ${item.teamNumber}` : ""}
                </strong>
                <time>{formatDate(item.updatedAt)}</time>
              </header>
              <div className="gvcn-officer-fields">
                {item.fieldDefs.map((field) => {
                  const value = item.fields[field.name];
                  if (!value || field.name === "members_json" || field.name === "write_mode" || field.name === "week_range") {
                    return null;
                  }
                  return (
                    <p key={field.name}>
                      <span>{field.label}</span>
                      {value}
                    </p>
                  );
                })}
              </div>
              <MemberTable json={item.fields.members_json} />
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}

const MEMBER_COLUMNS: Array<{ key: keyof TeamMemberWeekRow; label: string; detail?: keyof TeamMemberWeekRow }> = [
  { key: "absentCount", label: "Vắng", detail: "absentDates" },
  { key: "lateCount", label: "Trễ", detail: "lateDates" },
  { key: "notPreparedCount", label: "Ko thuộc bài", detail: "notPreparedSubjects" },
  { key: "noHomeworkCount", label: "Ko BTVN" },
  { key: "disorderCount", label: "Mất TT" },
  { key: "violationCount", label: "Vi phạm", detail: "violationDetail" },
  { key: "goodPointsCount", label: "Điểm tốt" },
  { key: "participationCount", label: "Phát biểu" },
];

/**
 * The tổ trưởng report carries a per-student grid in members_json that the desk
 * never showed — the teacher could only see the aggregated summary. Read-only.
 */
function MemberTable({ json }: { json?: string }) {
  const rows = parseMemberRows(json);
  const withData = rows.filter((row) =>
    MEMBER_COLUMNS.some((col) => Number(row[col.key]) > 0 || String(row[col.detail ?? col.key] ?? "").trim()),
  );
  if (!withData.length) {
    return rows.length ? <p className="gvcn-member-clean">Cả tổ không có lượt nào trong tuần.</p> : null;
  }

  return (
    <div className="gvcn-member-wrap">
      <table className="gvcn-member-table">
        <thead>
          <tr>
            <th>Học sinh</th>
            {MEMBER_COLUMNS.map((col) => (
              <th key={String(col.key)}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withData.map((row) => (
            <tr key={row.studentId || row.fullName}>
              <td>{row.fullName}</td>
              {MEMBER_COLUMNS.map((col) => {
                const count = Number(row[col.key]) || 0;
                const detail = col.detail ? String(row[col.detail] ?? "").trim() : "";
                return (
                  <td className={count ? "has-count" : ""} key={String(col.key)} title={detail || undefined}>
                    {count || (detail ? "•" : "—")}
                    {detail ? <em>{detail}</em> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViolationRow({ row }: { row: ViolationEntry }) {
  return (
    <tr>
      <td>{row.studentName}</td>
      <td>T{row.teamNumber}</td>
      <td>
        <span className={`gvcn-viol-tag gvcn-viol-${row.kind}`}>{row.kindLabel}</span>
      </td>
      <td>{row.count}</td>
      <td>{row.detail || "—"}</td>
    </tr>
  );
}
