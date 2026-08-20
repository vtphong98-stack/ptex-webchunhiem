"use client";

import { useCallback, useEffect, useState } from "react";

import { SEMESTER_LABELS, type Semester } from "@/lib/academic-calendar";
import type { ClassTargets, ClassTargetsActual, SemesterActual } from "@/lib/types";

type Level = { key: string; label: string };

const CONDUCT_LEVELS: Level[] = [
  { key: "tot", label: "Tốt" },
  { key: "kha", label: "Khá" },
  { key: "dat", label: "Đạt" },
  { key: "chuaDat", label: "Chưa đạt" },
];

const ACADEMIC_LEVELS: Level[] = [...CONDUCT_LEVELS, { key: "xuatSac", label: "Xuất sắc" }];

function emptySemester(): SemesterActual {
  return {
    totalStudents: 0,
    conduct: { tot: 0, kha: 0, dat: 0, chuaDat: 0 },
    academic: { tot: 0, kha: 0, dat: 0, chuaDat: 0, xuatSac: 0 },
    note: "",
  };
}

function targetCount(targets: ClassTargets | null, group: "conduct" | "academic", key: string) {
  const metric = (targets?.homeroom?.[group] as Record<string, { count?: number }> | undefined)?.[key];
  return metric?.count ?? 0;
}

function Delta({ actual, target }: { actual: number; target: number }) {
  if (!target && !actual) return <span className="cmp-delta">—</span>;
  const diff = actual - target;
  if (diff === 0) return <span className="cmp-delta is-met">đạt</span>;
  return (
    <span className={`cmp-delta ${diff > 0 ? "is-over" : "is-under"}`}>
      {diff > 0 ? `+${diff}` : diff}
    </span>
  );
}

export function TargetsCompare({ readOnly }: { readOnly?: boolean }) {
  const [targets, setTargets] = useState<ClassTargets | null>(null);
  const [actual, setActual] = useState<ClassTargetsActual>({ hk1: emptySemester(), hk2: emptySemester() });
  const [semester, setSemester] = useState<Semester>("hk1");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    // Targets and the recorded results are independent reads — fetch together.
    Promise.all([
      fetch("/api/gvcn/targets").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/gvcn/targets-actual").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([targetsRes, actualRes]) => {
        if (!alive) return;
        if (targetsRes?.data) setTargets(targetsRes.data as ClassTargets);
        if (actualRes?.data) setActual({ hk1: actualRes.data.hk1, hk2: actualRes.data.hk2 });
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const setField = useCallback(
    (group: "conduct" | "academic" | "root", key: string, value: string) => {
      const parsed = Math.max(0, Math.round(Number(value) || 0));
      setActual((current) => {
        const next = { ...current, [semester]: { ...current[semester] } } as ClassTargetsActual;
        const target = next[semester];
        if (group === "root") {
          target.totalStudents = parsed;
        } else {
          target[group] = { ...target[group], [key]: parsed } as never;
        }
        return next;
      });
    },
    [semester],
  );

  const save = useCallback(async () => {
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/gvcn/targets-actual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: actual }),
      });
      const data = await response.json().catch(() => ({}));
      setNotice(response.ok ? "Đã lưu kết quả thực tế." : data?.error ?? "Không lưu được.");
    } catch {
      setNotice("Lỗi mạng. Thử lại.");
    } finally {
      setPending(false);
    }
  }, [actual]);

  const current = actual[semester];
  const conductSum = CONDUCT_LEVELS.reduce(
    (total, level) => total + ((current.conduct as Record<string, number>)[level.key] ?? 0),
    0,
  );

  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold text-slate-900">Đối chiếu chỉ tiêu · thực tế theo học kỳ</h2>
      <p className="mt-1 text-sm text-slate-500">
        Web không có sổ điểm, nên số liệu hạnh kiểm / học lực thực tế thầy nhập từ hệ thống của trường. Chênh lệch được
        tính tự động so với chỉ tiêu đã đặt ở trên.
      </p>

      <div className="stat-controls mt-3">
        {(["hk1", "hk2"] as Semester[]).map((key) => (
          <button
            className={`stat-chip${semester === key ? " is-active" : ""}`}
            key={key}
            onClick={() => setSemester(key)}
            type="button"
          >
            {SEMESTER_LABELS[key]}
          </button>
        ))}
      </div>

      {!loaded ? <p className="mt-3 text-sm text-slate-500">Đang tải…</p> : null}

      <label className="cmp-total mt-4">
        Sĩ số cuối {SEMESTER_LABELS[semester].toLowerCase()}
        <input
          disabled={readOnly}
          inputMode="numeric"
          onChange={(event) => setField("root", "totalStudents", event.target.value)}
          value={current.totalStudents || ""}
        />
      </label>

      {(
        [
          { group: "conduct" as const, title: "Rèn luyện (hạnh kiểm)", levels: CONDUCT_LEVELS },
          { group: "academic" as const, title: "Học tập (học lực)", levels: ACADEMIC_LEVELS },
        ]
      ).map((block) => (
        <div className="cmp-block mt-4" key={block.group}>
          <h3>{block.title}</h3>
          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Mức</th>
                  <th>Chỉ tiêu</th>
                  <th>Thực tế</th>
                  <th>Chênh</th>
                </tr>
              </thead>
              <tbody>
                {block.levels.map((level) => {
                  const target = targetCount(targets, block.group, level.key);
                  const value = (current[block.group] as Record<string, number>)[level.key] ?? 0;
                  return (
                    <tr key={level.key}>
                      <td>{level.label}</td>
                      <td className="cmp-target">{target || "—"}</td>
                      <td>
                        <input
                          className="cmp-input"
                          disabled={readOnly}
                          inputMode="numeric"
                          onChange={(event) => setField(block.group, level.key, event.target.value)}
                          value={value || ""}
                        />
                      </td>
                      <td>
                        <Delta actual={value} target={target} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {block.group === "conduct" && current.totalStudents && conductSum !== current.totalStudents ? (
            <p className="cmp-warn">
              Tổng 4 mức rèn luyện = {conductSum}, khác sĩ số {current.totalStudents}.
            </p>
          ) : null}
        </div>
      ))}

      <label className="cmp-note mt-4">
        Ghi chú {SEMESTER_LABELS[semester].toLowerCase()}
        <textarea
          disabled={readOnly}
          onChange={(event) =>
            setActual((currentValue) => ({
              ...currentValue,
              [semester]: { ...currentValue[semester], note: event.target.value },
            }))
          }
          rows={2}
          value={current.note ?? ""}
        />
      </label>

      {notice ? <p className="mt-3 text-sm font-semibold text-indigo-700">{notice}</p> : null}

      {!readOnly ? (
        <button className="button-primary mt-4" disabled={pending} onClick={() => void save()} type="button">
          {pending ? "Đang lưu…" : "Lưu kết quả thực tế"}
        </button>
      ) : null}
    </section>
  );
}
