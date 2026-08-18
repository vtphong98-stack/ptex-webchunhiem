"use client";

import { useEffect, useMemo, useState } from "react";

import { logoutAction, saveReportAction } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getOfficerTitle, getReportFields } from "@/lib/report-fields";
import type { AppRole } from "@/lib/types";
import { buildExcelWeeks } from "@/lib/weeks";

type SavedReport = {
  _id: string;
  weekNumber: number;
  weekLabel: string;
  fields: Record<string, string>;
  updatedAt: string;
};

export function OfficerDesk({
  fullName,
  role,
  teamNumber,
}: {
  fullName: string;
  role: AppRole;
  teamNumber: number | null;
}) {
  const weeks = useMemo(() => buildExcelWeeks(), []);
  const fields = useMemo(() => getReportFields(role), [role]);
  const [schoolYearId, setSchoolYearId] = useState("");
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [weekNumber, setWeekNumber] = useState(1);

  useEffect(() => {
    fetch("/api/officer/reports")
      .then((response) => response.json())
      .then((data) => {
        const items = (data.reports ?? []) as SavedReport[];
        setSchoolYearId(data.schoolYearId ?? "");
        setReports(items);
        if (items[0]?.weekNumber) setWeekNumber(items[0].weekNumber);
      })
      .catch(() => undefined);
  }, []);

  const current = reports.find((item) => item.weekNumber === weekNumber);

  return (
    <main className="py-6">
      <div className="officer-form">
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
        <h1>{getOfficerTitle(role, teamNumber)}</h1>
        <h2>
          {fullName}
          {teamNumber ? ` · Tổ ${teamNumber}` : ""}
        </h2>
        <form action={saveReportAction} className="space-y-4" key={weekNumber}>
          <input name="schoolYearId" type="hidden" value={schoolYearId} />
          <div>
            <label htmlFor="weekNumber">TUẦN THỨ (phải nhập chính xác)</label>
            <select
              defaultValue={String(weekNumber)}
              id="weekNumber"
              name="weekNumber"
              onChange={(event) => setWeekNumber(Number(event.target.value))}
              required
            >
              {weeks.map((week) => (
                <option key={week.weekNumber} value={week.weekNumber}>
                  {week.label}
                  {week.dateRangeLabel ? ` · ${week.dateRangeLabel}` : ""}
                </option>
              ))}
            </select>
          </div>
          {fields.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              <input
                defaultValue={current?.fields?.[field.name] ?? ""}
                id={field.name}
                name={field.name}
                placeholder={field.placeholder}
              />
            </div>
          ))}
          <SubmitButton className="button-primary w-full" pendingText="Đang gửi…">
            Gửi dữ liệu
          </SubmitButton>
        </form>

        {reports.length ? (
          <section className="mt-6 space-y-3">
            <p className="text-center text-sm font-semibold text-slate-600">Báo cáo đã gửi</p>
            {reports.slice(0, 8).map((report) => (
              <details className="rounded-xl bg-slate-50 p-4" key={report._id}>
                <summary className="cursor-pointer font-semibold">{report.weekLabel}</summary>
                <div className="mt-3 space-y-2 text-sm">
                  {fields.map((field) => (
                    <p key={field.name}>
                      <strong>{field.label}:</strong> {report.fields?.[field.name] || "—"}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
