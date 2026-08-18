"use client";

import { useCallback, useState } from "react";

import type { ReportField } from "@/lib/report-fields";

export type SavedReport = {
  _id: string;
  weekNumber: number;
  weekLabel: string;
  fields: Record<string, string>;
  updatedAt: string;
};

export type TeamStudent = { _id: string; fullName: string; teamRole: string | null };

export const REPORTS_PAGE_SIZE = 5;

export function useOfficerReports() {
  const [schoolYearId, setSchoolYearId] = useState("");
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [teamStudents, setTeamStudents] = useState<TeamStudent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (skip: number, limit: number) => {
    const response = await fetch(`/api/officer/reports?limit=${limit}&skip=${skip}`);
    if (!response.ok) {
      throw new Error("fetch_failed");
    }
    const data = await response.json();
    return {
      schoolYearId: (data.schoolYearId ?? "") as string,
      reports: (data.reports ?? []) as SavedReport[],
      teamStudents: (data.teamStudents ?? []) as TeamStudent[],
      hasMore: Boolean(data.hasMore),
    };
  }, []);

  const loadInitial = useCallback(async () => {
    const data = await fetchPage(0, REPORTS_PAGE_SIZE);
    setSchoolYearId(data.schoolYearId);
    setReports(data.reports);
    setTeamStudents(data.teamStudents);
    setHasMore(data.hasMore);
    return data;
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    const limit = Math.max(REPORTS_PAGE_SIZE, reports.length);
    const data = await fetchPage(0, limit);
    setSchoolYearId(data.schoolYearId);
    setReports(data.reports);
    setTeamStudents(data.teamStudents);
    setHasMore(data.hasMore);
    return data;
  }, [fetchPage, reports.length]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(reports.length, REPORTS_PAGE_SIZE);
      setReports((current) => [...current, ...data.reports]);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, reports.length]);

  return {
    schoolYearId,
    reports,
    teamStudents,
    hasMore,
    loadingMore,
    loadInitial,
    refresh,
    loadMore,
  };
}

export function reportFieldLines(report: SavedReport, fields: ReportField[], hideEmpty = true) {
  return fields
    .map((field) => ({
      key: field.name,
      label: field.label,
      value: report.fields?.[field.name]?.trim() || "—",
    }))
    .filter((line) => !hideEmpty || (line.value !== "—" && line.value !== "0"));
}
