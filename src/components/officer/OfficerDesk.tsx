"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction, saveReportAction } from "@/app/dashboard/actions";
import { TeamLeaderForm } from "@/components/officer/TeamLeaderForm";
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
  if (role === "toTruong" && teamNumber) {
    return <TeamLeaderForm fullName={fullName} teamNumber={teamNumber} />;
  }

  return <GenericOfficerForm fullName={fullName} role={role} teamNumber={teamNumber} />;
}

function GenericOfficerForm({
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
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const reportsRef = useRef<HTMLElement>(null);

  const loadReports = useCallback(async () => {
    const response = await fetch("/api/officer/reports");
    if (!response.ok) return;
    const data = await response.json();
    const items = (data.reports ?? []) as SavedReport[];
    setSchoolYearId(data.schoolYearId ?? "");
    setReports(items);
    return items;
  }, []);

  useEffect(() => {
    void loadReports().then((items) => {
      if (items?.[0]?.weekNumber) setWeekNumber(items[0].weekNumber);
    });
  }, [loadReports]);

  const current = reports.find((item) => item.weekNumber === weekNumber);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const formData = new FormData(event.currentTarget);
      await saveReportAction(formData);
      await loadReports();
      setSuccessMessage("Báo cáo thành công");
      requestAnimationFrame(() => {
        reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      setErrorMessage("Không gửi được báo cáo. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

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
        <form className="space-y-4" key={weekNumber} onSubmit={(event) => void handleSubmit(event)}>
          <input name="schoolYearId" type="hidden" value={schoolYearId} />
          <div>
            <label htmlFor="weekNumber">TUẦN THỨ (phải nhập chính xác)</label>
            <select
              defaultValue={String(weekNumber)}
              id="weekNumber"
              name="weekNumber"
              onChange={(event) => {
                setWeekNumber(Number(event.target.value));
                setSuccessMessage("");
                setErrorMessage("");
              }}
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
          <button className="button-primary w-full" disabled={pending} type="submit">
            {pending ? "Đang gửi…" : "Gửi dữ liệu"}
          </button>
        </form>

        {successMessage ? (
          <p className="success-note" role="status">
            {successMessage}
          </p>
        ) : null}
        {errorMessage ? <p className="status-note">{errorMessage}</p> : null}

        {reports.length ? (
          <section className="mt-6 space-y-3" ref={reportsRef}>
            <p className="text-center text-sm font-semibold text-slate-600">Báo cáo đã gửi</p>
            {reports.map((report) => (
              <details className="rounded-xl bg-slate-50 p-4" key={report._id} open={report.weekNumber === weekNumber && Boolean(successMessage)}>
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
