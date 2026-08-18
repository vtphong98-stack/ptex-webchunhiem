"use client";

import { useCallback, useState } from "react";

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
        <button className="button-primary gvcn-copy-btn" onClick={() => void copyReport()} type="button">
          {copied ? "✓ Đã copy" : "Copy nội dung báo cáo"}
        </button>
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
          <p className="gvcn-violations-note">Ánh xạ trực tiếp từ báo cáo tổ trưởng (TT1–TT4)</p>
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

      <details className="gvcn-officer-refs">
        <summary>Báo cáo gốc từng chức vụ ({reports.length})</summary>
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
            </article>
          ))}
        </div>
      </details>
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
