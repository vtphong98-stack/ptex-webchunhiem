"use client";

import { useEffect, useMemo, useState } from "react";

import { HK1_LAST_WEEK } from "@/lib/academic-calendar";

type Tally = {
  violations: number;
  absences: number;
  lates: number;
  notPrepared: number;
  noHomework: number;
  disorder: number;
  goodPoints: number;
  participation: number;
};

type StatRow = {
  id: string;
  fullName: string;
  teamNumber: number | null;
  hk1: Tally;
  hk2: Tally;
  total: Tally;
};

type SemesterKey = "hk1" | "hk2" | "total";

const SEMESTERS: Array<{ key: SemesterKey; label: string; hint: string }> = [
  { key: "hk1", label: "Học kỳ 1", hint: `tuần 1–${HK1_LAST_WEEK}` },
  { key: "hk2", label: "Học kỳ 2", hint: `tuần ${HK1_LAST_WEEK + 1}–35` },
  { key: "total", label: "Cả năm", hint: "tuần 1–35" },
];

/** Faults first, then the positives — the column the teacher sorts by. */
const COLUMNS: Array<{ key: keyof Tally; label: string; kind: "bad" | "good" }> = [
  { key: "violations", label: "Vi phạm", kind: "bad" },
  { key: "absences", label: "Vắng", kind: "bad" },
  { key: "lates", label: "Trễ", kind: "bad" },
  { key: "notPrepared", label: "Không thuộc bài", kind: "bad" },
  { key: "noHomework", label: "Không BTVN", kind: "bad" },
  { key: "disorder", label: "Mất trật tự", kind: "bad" },
  { key: "goodPoints", label: "Điểm tốt", kind: "good" },
  { key: "participation", label: "Phát biểu", kind: "good" },
];

function faultTotal(tally: Tally) {
  return tally.violations + tally.absences + tally.lates + tally.notPrepared + tally.noHomework + tally.disorder;
}

export function SemesterStats({ yearName }: { yearName: string }) {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [semester, setSemester] = useState<SemesterKey>("total");
  const [sortBy, setSortBy] = useState<keyof Tally | "faults" | "name">("faults");
  const [error, setError] = useState("");
  // Derived instead of a setState at the top of the effect, which would cascade
  // an extra render every time the school year changes.
  const [loadedYear, setLoadedYear] = useState<string | null>(null);
  const loading = loadedYear !== yearName;

  useEffect(() => {
    let alive = true;
    const qs = yearName ? `?year=${encodeURIComponent(yearName)}` : "";
    fetch(`/api/gvcn/student-stats${qs}`)
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!alive) return;
        setRows(data?.rows ?? []);
        setError(data ? "" : "Chưa tải được thống kê.");
      })
      .catch(() => alive && setError("Chưa tải được thống kê."))
      .finally(() => alive && setLoadedYear(yearName));
    return () => {
      alive = false;
    };
  }, [yearName]);

  const sorted = useMemo(() => {
    const list = [...rows];
    if (sortBy === "name") {
      return list.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
    }
    if (sortBy === "faults") {
      return list.sort(
        (a, b) => faultTotal(b[semester]) - faultTotal(a[semester]) || a.fullName.localeCompare(b.fullName, "vi"),
      );
    }
    return list.sort(
      (a, b) => b[semester][sortBy] - a[semester][sortBy] || a.fullName.localeCompare(b.fullName, "vi"),
    );
  }, [rows, semester, sortBy]);

  const classTotals = useMemo(() => {
    const sum = COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: 0 }), {} as Record<string, number>);
    for (const row of rows) for (const col of COLUMNS) sum[col.key] += row[semester][col.key];
    return sum;
  }, [rows, semester]);

  const cleanCount = useMemo(
    () => rows.filter((row) => faultTotal(row[semester]) === 0).length,
    [rows, semester],
  );

  if (loading) return <p className="py-6 text-center text-sm text-slate-500">Đang tính thống kê…</p>;
  if (error) return <p className="py-6 text-center text-sm text-rose-700">{error}</p>;
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">Chưa có dữ liệu học sinh.</p>;

  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold text-slate-900">Thống kê vi phạm theo học kỳ</h2>
      <p className="mt-1 text-sm text-slate-500">
        Tổng hợp từ báo cáo tổ trưởng hàng tuần. Bấm tên cột để xếp theo cột đó.
      </p>

      <div className="stat-controls mt-3">
        {SEMESTERS.map((item) => (
          <button
            className={`stat-chip${semester === item.key ? " is-active" : ""}`}
            key={item.key}
            onClick={() => setSemester(item.key)}
            type="button"
          >
            {item.label}
            <span>{item.hint}</span>
          </button>
        ))}
      </div>

      <div className="stat-summary mt-3">
        <span className="stat-pill tone-clean">
          <strong>{cleanCount}</strong>/{rows.length} em không lượt vi phạm
        </span>
        {COLUMNS.filter((col) => classTotals[col.key] > 0).map((col) => (
          <span className={`stat-pill ${col.kind === "bad" ? "tone-bad" : "tone-good"}`} key={col.key}>
            {col.label}: <strong>{classTotals[col.key]}</strong>
          </span>
        ))}
      </div>

      <div className="stat-table-wrap mt-4">
        <table className="stat-table">
          <thead>
            <tr>
              <th className="stat-sticky">
                <button onClick={() => setSortBy("name")} type="button">
                  Học sinh
                </button>
              </th>
              <th>Tổ</th>
              <th>
                <button onClick={() => setSortBy("faults")} type="button">
                  Tổng lỗi{sortBy === "faults" ? " ▾" : ""}
                </button>
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key}>
                  <button onClick={() => setSortBy(col.key)} type="button">
                    {col.label}
                    {sortBy === col.key ? " ▾" : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const tally = row[semester];
              const faults = faultTotal(tally);
              return (
                <tr className={faults === 0 ? "is-clean" : faults >= 5 ? "is-hot" : ""} key={row.id}>
                  <td className="stat-sticky">{row.fullName}</td>
                  <td>{row.teamNumber ? `T${row.teamNumber}` : "—"}</td>
                  <td>
                    <strong>{faults || "—"}</strong>
                  </td>
                  {COLUMNS.map((col) => (
                    <td className={tally[col.key] ? `has-${col.kind}` : ""} key={col.key}>
                      {tally[col.key] || "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
