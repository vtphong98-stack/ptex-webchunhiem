"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { logoutAction, saveReportAction } from "@/app/dashboard/actions";
import { CampaignForm } from "@/components/officer/CampaignForm";
import { DisciplineForm } from "@/components/officer/DisciplineForm";
import { LaborForm } from "@/components/officer/LaborForm";
import { SubmittedReportsList } from "@/components/officer/SubmittedReportsList";
import { TeamLeaderForm } from "@/components/officer/TeamLeaderForm";
import { useOfficerReports } from "@/components/officer/use-officer-reports";
import { getOfficerTitle, getReportFields } from "@/lib/report-fields";
import type { AppRole } from "@/lib/types";
import { buildExcelWeeks } from "@/lib/weeks";

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

  if (role === "lopPhoLaoDong") {
    return <LaborForm fullName={fullName} />;
  }

  if (role === "lopPhoTratTu") {
    return <DisciplineForm fullName={fullName} />;
  }

  if (role === "lopPhoPhongTrao") {
    return <CampaignForm fullName={fullName} />;
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
  const { reports, hasMore, loadingMore, loadInitial, refresh, loadMore } = useOfficerReports();
  const [schoolYearId, setSchoolYearId] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const reportsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void loadInitial().then((data) => {
      if (data?.schoolYearId) setSchoolYearId(data.schoolYearId);
      if (data?.reports[0]?.weekNumber) setWeekNumber(data.reports[0].weekNumber);
    });
  }, [loadInitial]);

  const current = reports.find((item) => item.weekNumber === weekNumber);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const formData = new FormData(event.currentTarget);
      await saveReportAction(formData);
      const data = await refresh();
      if (data?.schoolYearId) setSchoolYearId(data.schoolYearId);
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

        <SubmittedReportsList
          fields={fields}
          hasMore={hasMore}
          highlightWeekNumber={weekNumber}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          reports={reports}
          sectionRef={reportsRef}
          showSuccessHighlight={Boolean(successMessage)}
        />
      </div>
    </main>
  );
}
