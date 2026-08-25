"use client";

import { useCallback, useEffect, useState } from "react";

import { buildWeeks2026 } from "@/lib/academic-calendar";
import { CLASS_SITE } from "@/lib/class-site";
import {
  TEACHER_AFTERNOON_PERIODS,
  TEACHER_DAY_LABELS,
  TEACHER_EVENING_PERIODS,
  TEACHER_MORNING_PERIODS,
} from "@/lib/excel-teacher-timetable";
import { downloadBlob, renderTimetablePng, type TimetableSession } from "@/lib/timetable-image";
import { formatDateTime } from "@/lib/utils";

/* ─── Color generator (consistent per class name) ─── */
const PALETTE = [
  "#4361ee", "#f72585", "#4cc9f0", "#7209b7", "#3a0ca3",
  "#06d6a0", "#ef476f", "#ffd166", "#118ab2", "#073b4c",
  "#e63946", "#457b9d", "#2a9d8f", "#e9c46a", "#264653",
  "#fb5607", "#ff006e", "#8338ec", "#3a86ff", "#ffbe0b",
];

function classColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

type TimetableGrid = { morning: Record<number, string[]>; afternoon: Record<number, string[]>; evening: Record<number, string[]> };

type VersionRow = { id: string; createdAt: string; createdByName?: string };

const SESSIONS: Array<{ key: keyof TimetableGrid; title: string; periods: number[] }> = [
  { key: "morning", title: "Buổi Sáng", periods: TEACHER_MORNING_PERIODS },
  { key: "afternoon", title: "Buổi Chiều", periods: TEACHER_AFTERNOON_PERIODS },
  { key: "evening", title: "Buổi Tối", periods: TEACHER_EVENING_PERIODS },
];

function emptyGrid(): TimetableGrid {
  const session = (periods: number[]) =>
    Object.fromEntries(periods.map((p) => [p, TEACHER_DAY_LABELS.map(() => "-")]));
  return {
    morning: session(TEACHER_MORNING_PERIODS),
    afternoon: session(TEACHER_AFTERNOON_PERIODS),
    evening: session(TEACHER_EVENING_PERIODS),
  };
}

/* ─── TeacherTimetable (gõ trực tiếp / upload / phiên bản / xuất ảnh) ───── */
export function TeacherTimetable() {
  const [grid, setGrid] = useState<TimetableGrid | null>(null);
  const [draft, setDraft] = useState<TimetableGrid>(() => emptyGrid());
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"type" | "excel">("type");
  const [updatedAt, setUpdatedAt] = useState("");
  const [status, setStatus] = useState("Đang tải…");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  /** Đang xem một bản cũ — chỉ để xem và xuất ảnh, không ghi đè bản đang dùng. */
  const [viewing, setViewing] = useState<{ id: string; createdAt: string; data: TimetableGrid } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/gvcn/teacher-timetable");
      if (!r.ok) throw new Error("load");
      const d = await r.json();
      setVersions(Array.isArray(d.versions) ? d.versions : []);
      setUpdatedAt(d.updatedAt || "");
      if (d.data) {
        setGrid(d.data);
        setDraft(d.data);
        setStatus("");
      } else {
        setGrid(null);
        setDraft(emptyGrid());
        setStatus("Chưa có lịch dạy. Gõ thẳng vào bảng bên dưới, hoặc tải mẫu Excel rồi upload.");
      }
      setDirty(false);
    } catch {
      setStatus("Không tải được dữ liệu.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function applySaved(d: { updatedAt?: string; data?: TimetableGrid; versions?: VersionRow[] }, done: string) {
    setUpdatedAt(d.updatedAt || "");
    if (d.data) {
      setGrid(d.data);
      setDraft(d.data);
      setStatus("");
    }
    setVersions(Array.isArray(d.versions) ? d.versions : []);
    setViewing(null);
    setDirty(false);
    setMsg(done);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg("");
    const form = new FormData();
    form.set("file", file);
    const r = await fetch("/api/gvcn/teacher-timetable", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Upload thất bại.");
      return;
    }
    // Đổ luôn sang bảng gõ trực tiếp để sửa tiếp, khỏi mở lại Excel.
    applySaved(d, "Đã cập nhật lịch dạy. Bảng gõ trực tiếp đã lấy sẵn dữ liệu này.");
  }

  async function saveDraft() {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/gvcn/teacher-timetable", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid: draft }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Không lưu được lịch dạy.");
      return;
    }
    applySaved(d, "Đã lưu lịch dạy. Bản trước được giữ lại để xem lại.");
  }

  async function openVersion(id: string, createdAt: string) {
    setBusy(true);
    setMsg("");
    const r = await fetch(`/api/gvcn/teacher-timetable/${id}`);
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !d.data) {
      setMsg(d.error || "Không mở được phiên bản cũ.");
      return;
    }
    setViewing({ id, createdAt, data: d.data });
  }

  async function removeVersion(id: string) {
    if (!window.confirm("Xóa phiên bản lịch dạy cũ này? Không thể hoàn tác.")) return;
    setBusy(true);
    const r = await fetch(`/api/gvcn/teacher-timetable/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || "Không xóa được phiên bản cũ.");
      return;
    }
    setVersions(Array.isArray(d.versions) ? d.versions : []);
    if (viewing?.id === id) setViewing(null);
    setMsg("Đã xóa phiên bản cũ.");
  }

  async function saveImage() {
    const shown = viewing?.data ?? grid;
    if (!shown) return;
    setBusy(true);
    try {
      const sessions: TimetableSession[] = SESSIONS.map(({ key, title, periods }) => ({
        title,
        periods,
        rows: Object.fromEntries(
          periods.map((p) => [
            p,
            (shown[key]?.[p] ?? TEACHER_DAY_LABELS.map(() => "-")).map((cell) => {
              const name = (cell ?? "").trim();
              const empty = !name || name === "-";
              // Ô lịch dạy tô theo tên lớp, không theo môn, nên tự mang màu.
              return empty
                ? { subject: "-" }
                : { subject: name, tone: { bg: classColor(name), ink: "#ffffff" } };
            }),
          ]),
        ),
      }));
      const blob = await renderTimetablePng({
        sessions,
        palette: {},
        className: "",
        schoolYear: CLASS_SITE.schoolYear,
        gvcnName: CLASS_SITE.gvcnName,
        updatedAt: formatDateTime(viewing?.createdAt || updatedAt),
        days: TEACHER_DAY_LABELS,
        title: "Lịch dạy giáo viên",
      });
      if (!blob) {
        setMsg("Không tạo được ảnh.");
        return;
      }
      downloadBlob(blob, `lich-day-${(viewing?.createdAt || updatedAt || "").slice(0, 10) || "hien-tai"}.png`);
      setMsg("Đã lưu ảnh lịch dạy.");
    } finally {
      setBusy(false);
    }
  }

  function setCell(key: keyof TimetableGrid, period: number, day: number, value: string) {
    const cells = [...(draft[key]?.[period] ?? TEACHER_DAY_LABELS.map(() => "-"))];
    cells[day] = value;
    setDraft({ ...draft, [key]: { ...draft[key], [period]: cells } });
    setDirty(true);
  }

  const shown = viewing?.data ?? grid;

  return (
    <section className="tt-section">
      <h3 className="tt-toggle" onClick={() => setOpen(!open)}>
        📅 Lịch Dạy Giáo Viên
        <span className={`tt-chevron ${open ? "tt-chevron-open" : ""}`}>▼</span>
      </h3>
      {open && (
        <div className="tt-body">
          <p className="text-sm leading-6 text-slate-600">
            Hai cách nhập: <b>gõ trực tiếp</b> ngay dưới đây, hoặc <b>file Excel</b>. Mỗi lần lưu, bản trước được
            giữ lại để xem lại và xuất ảnh.
          </p>

          <div className="tkb-mode">
            <button
              className={mode === "type" ? "button-primary" : "button-secondary"}
              onClick={() => setMode("type")}
              type="button"
            >
              Gõ trực tiếp
            </button>
            <button
              className={mode === "excel" ? "button-primary" : "button-secondary"}
              onClick={() => setMode("excel")}
              type="button"
            >
              File Excel
            </button>
          </div>

          {mode === "excel" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="button-secondary" href="/api/gvcn/teacher-timetable/template">
                Tải mẫu Excel
              </a>
              <label className="button-primary" style={{ cursor: "pointer" }}>
                {busy ? "Đang tải…" : "Tải lên"}
                <input
                  accept=".xlsx,.xls"
                  disabled={busy}
                  hidden
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  type="file"
                />
              </label>
            </div>
          ) : (
            <div className="mt-3">
              <p className="mb-2 text-sm text-slate-600">
                Mỗi ô ghi tên lớp đang dạy tiết đó (12A1, 11A1, HSG, 12TT…). Ô trống là không có tiết.
              </p>
              {SESSIONS.map(({ key, title, periods }) => (
                <div className="tkb-edit-block" key={key}>
                  <h4>{title}</h4>
                  <div className="tkb-edit-scroll">
                    <table className="tkb-edit-table tkb-edit-table-7">
                      <thead>
                        <tr>
                          <th scope="col">Tiết</th>
                          {TEACHER_DAY_LABELS.map((d) => (
                            <th key={d} scope="col">
                              {d}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((p) => (
                          <tr key={p}>
                            <th scope="row">{p}</th>
                            {TEACHER_DAY_LABELS.map((d, i) => {
                              const value = draft[key]?.[p]?.[i] ?? "";
                              return (
                                <td key={d}>
                                  <input
                                    aria-label={`${title}, thứ ${d}, tiết ${p}`}
                                    autoComplete="off"
                                    onChange={(e) => setCell(key, p, i, e.target.value)}
                                    placeholder="—"
                                    value={value === "-" ? "" : value}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className="button-primary" disabled={busy || !dirty} onClick={() => void saveDraft()} type="button">
                  {busy ? "Đang lưu…" : "Lưu lịch dạy"}
                </button>
                <button className="button-secondary" disabled={busy || !dirty} onClick={() => void load()} type="button">
                  Hoàn tác
                </button>
                {dirty ? <span className="text-sm text-amber-700">Có thay đổi chưa lưu.</span> : null}
              </div>
            </div>
          )}

          {updatedAt ? (
            <p className="mt-3 text-sm font-semibold text-indigo-700">Cập nhật: {formatDateTime(updatedAt)}</p>
          ) : null}
          {msg ? (
            <p className={`mt-2 text-sm ${msg.includes("Không") || msg.includes("thất bại") ? "text-red-600" : "text-green-700"}`}>
              {msg}
            </p>
          ) : null}
          {status ? <p className="tt-status">{status}</p> : null}

          {shown ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="button-secondary" disabled={busy} onClick={() => void saveImage()} type="button">
                  🖼️ Lưu ảnh lịch dạy
                </button>
                {viewing ? (
                  <>
                    <span className="text-sm text-amber-700">
                      Đang xem bản {formatDateTime(viewing.createdAt)}
                    </span>
                    <button className="button-secondary" onClick={() => setViewing(null)} type="button">
                      Về bản hiện hành
                    </button>
                  </>
                ) : null}
              </div>
              {SESSIONS.map(({ key, title }) => (
                <TimetableTable data={shown[key] ?? {}} key={key} title={title} />
              ))}
            </>
          ) : null}

          <h4 className="mt-4 text-base font-semibold">Phiên bản cũ</h4>
          {!versions.length ? (
            <p className="mt-1 text-sm text-slate-500">Chưa có bản cũ. Lưu lịch mới thì bản đang dùng sẽ vào đây.</p>
          ) : (
            <ul className="tkb-history">
              {versions.map((v) => (
                <li key={v.id}>
                  <div>
                    <strong>{formatDateTime(v.createdAt)}</strong>
                    {v.createdByName ? <span> · {v.createdByName}</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="button-secondary"
                      disabled={busy}
                      onClick={() => void openVersion(v.id, v.createdAt)}
                      type="button"
                    >
                      Xem
                    </button>
                    <button className="button-secondary" disabled={busy} onClick={() => void removeVersion(v.id)} type="button">
                      Xóa
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TimetableTable({ title, data }: { title: string; data: Record<number, string[]> }) {
  const periods = Object.keys(data).map(Number).sort((a, b) => a - b);
  if (!periods.length) return null;
  const days = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"];

  return (
    <>
      <p className="tt-session-title">{title}</p>
      <div className="tt-table-wrap">
        <table className="tt-table">
          <thead>
            <tr>
              <th className="tt-th-period">Tiết</th>
              {days.map((d) => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p}>
                <td className="tt-period">{p}</td>
                {(data[p] || []).map((cell, i) => (
                  <td key={i} className="tt-td">
                    {cell && cell !== "-" ? (
                      <div
                        className="tt-cell"
                        style={{ backgroundColor: classColor(cell), color: "#fff" }}
                      >
                        {cell}
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── Public TeacherTimetableView (no upload) ─── */
export function TeacherTimetableView({ initialGrid }: { initialGrid?: TimetableGrid | null }) {
  const [grid, setGrid] = useState<TimetableGrid | null>(initialGrid ?? null);
  const [status, setStatus] = useState(initialGrid ? "" : "Đang tải lịch dạy…");

  useEffect(() => {
    if (initialGrid !== undefined) return;
    fetch("/api/gvcn/teacher-timetable")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data) {
          setGrid(d.data);
          setStatus("");
        } else {
          setStatus("Chưa có lịch dạy.");
        }
      })
      .catch(() => setStatus("Không tải được."));
  }, [initialGrid]);

  if (status) return <p style={{ textAlign: "center", padding: 24, color: "#64748b" }}>{status}</p>;
  if (!grid) return null;

  return (
    <div className="tt-body">
      <TimetableTable title="Buổi Sáng" data={grid.morning} />
      <TimetableTable title="Buổi Chiều" data={grid.afternoon} />
      <TimetableTable title="Buổi Tối" data={grid.evening} />
    </div>
  );
}

/* ─── TeachingPlan (upload + view) ───────── */
type PlanRecord = { week: number; period: number; lesson: string; note: string };
type PlanData = { lop11: PlanRecord[]; lop12: PlanRecord[] };

export function TeachingPlan() {
  const [data, setData] = useState<PlanData | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [week11, setWeek11] = useState<number | null>(null);
  const [week12, setWeek12] = useState<number | null>(null);
  const [status, setStatus] = useState("Đang tải…");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const currentWeek = useCallback(() => {
    const weeks = buildWeeks2026();
    const now = Date.now();
    for (const w of weeks) {
      if (!w.startDate || !w.endDate) continue;
      if (now >= new Date(w.startDate).getTime() && now < new Date(w.endDate).getTime() + 86400000)
        return w.weekNumber;
    }
    return 1;
  }, []);

  useEffect(() => {
    fetch("/api/gvcn/teaching-plan")
      .then(async (r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.data) {
          setData(d.data);
          setUpdatedAt(d.updatedAt || "");
          const cw = currentWeek();
          const w11 = [...new Set((d.data.lop11 as PlanRecord[]).map((r) => r.week))].sort((a, b) => a - b);
          const w12 = [...new Set((d.data.lop12 as PlanRecord[]).map((r) => r.week))].sort((a, b) => a - b);
          setWeek11(w11.includes(cw) ? cw : w11[0] ?? null);
          setWeek12(w12.includes(cw) ? cw : w12[0] ?? null);
          setStatus("");
        } else setStatus("Chưa có báo giảng. Tải mẫu Excel, điền rồi upload.");
      })
      .catch(() => setStatus("Không tải được."));
  }, [currentWeek]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setMsg("");
    const form = new FormData();
    form.set("file", file);
    const r = await fetch("/api/gvcn/teaching-plan", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setUploading(false);
    if (!r.ok) { setMsg(d.error || "Upload thất bại."); return; }
    setUpdatedAt(d.updatedAt || "");
    setMsg(`Đã cập nhật! Lớp 11: ${d.lop11 ?? 0} records, Lớp 12: ${d.lop12 ?? 0} records.`);
    // Reload
    const r2 = await fetch("/api/gvcn/teaching-plan");
    const d2 = await r2.json().catch(() => null);
    if (d2?.data) { setData(d2.data); setStatus(""); }
  }

  return (
    <section className="tp-section">
      <h3 className="tp-title">📖 Phân Phối Chương Trình / Lịch Báo Giảng</h3>
      <div className="mt-2 flex flex-wrap gap-2 mb-3">
        <a className="button-secondary" href="/api/gvcn/teaching-plan/template">Tải mẫu Excel</a>
        <label className={`button-primary ${uploading ? "opacity-50" : ""}`} style={{ cursor: "pointer" }}>
          {uploading ? "Đang tải…" : "Upload báo giảng"}
          <input type="file" accept=".xlsx,.xls" hidden disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>
      {updatedAt ? <p className="text-sm text-indigo-700 font-semibold mb-2">Cập nhật: {formatDateTime(updatedAt)}</p> : null}
      {msg ? <p className={`text-sm mb-2 ${msg.includes("thất bại") ? "text-red-600" : "text-green-700"}`}>{msg}</p> : null}
      {status ? <p className="tp-status">{status}</p> : null}
      {data ? (
        <div className="tp-layout">
          <PlanPanel label="Lớp 11" records={data.lop11} week={week11} setWeek={setWeek11} />
          <PlanPanel label="Lớp 12" records={data.lop12} week={week12} setWeek={setWeek12} />
        </div>
      ) : null}
    </section>
  );
}

function PlanPanel({ label, records, week, setWeek }: {
  label: string; records: PlanRecord[]; week: number | null; setWeek: (w: number) => void;
}) {
  const weeks = [...new Set(records.map((r) => r.week))].sort((a, b) => a - b);
  const idx = week !== null ? weeks.indexOf(week) : -1;
  const filtered = records.filter((r) => r.week === week).sort((a, b) => a.period - b.period);

  return (
    <div className="tp-panel">
      <h4 className="tp-class-title">{label}</h4>
      <div className="tp-controls">
        <button className="tp-btn" disabled={idx <= 0} onClick={() => idx > 0 && setWeek(weeks[idx - 1])}>◀ Trước</button>
        <span className="tp-week-label">Tuần {week ?? "—"}</span>
        <button className="tp-btn" disabled={idx < 0 || idx >= weeks.length - 1} onClick={() => idx < weeks.length - 1 && setWeek(weeks[idx + 1])}>Sau ▶</button>
      </div>
      {filtered.length ? (
        <table className="tp-table">
          <thead><tr><th>Tiết</th><th>Bài dạy</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td className="tp-period">Tiết {r.period}</td>
                <td>{r.lesson}</td>
                <td style={{ color: "#64748b", fontSize: 12 }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="tp-empty">Không có dữ liệu tuần {week}</p>}
    </div>
  );
}

/* ─── Public TeachingPlanView (no upload) ── */
export function TeachingPlanView({ initialData }: { initialData?: PlanData | null }) {
  const currentWeek = useCallback(() => {
    const weeks = buildWeeks2026();
    const now = Date.now();
    for (const w of weeks) {
      if (!w.startDate || !w.endDate) continue;
      if (now >= new Date(w.startDate).getTime() && now < new Date(w.endDate).getTime() + 86400000)
        return w.weekNumber;
    }
    return 1;
  }, []);

  const [data, setData] = useState<PlanData | null>(initialData ?? null);
  const [week11, setWeek11] = useState<number | null>(() => {
    if (!initialData?.lop11?.length) return null;
    const cw = currentWeek();
    const w11 = [...new Set(initialData.lop11.map((r) => r.week))].sort((a, b) => a - b);
    return w11.includes(cw) ? cw : w11[0] ?? null;
  });
  const [week12, setWeek12] = useState<number | null>(() => {
    if (!initialData?.lop12?.length) return null;
    const cw = currentWeek();
    const w12 = [...new Set(initialData.lop12.map((r) => r.week))].sort((a, b) => a - b);
    return w12.includes(cw) ? cw : w12[0] ?? null;
  });
  const [status, setStatus] = useState(initialData ? "" : "Đang tải…");

  useEffect(() => {
    if (initialData !== undefined) return;
    fetch("/api/gvcn/teaching-plan")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data) {
          setData(d.data);
          const cw = currentWeek();
          const w11 = [...new Set((d.data.lop11 as PlanRecord[]).map((r) => r.week))].sort((a, b) => a - b);
          const w12 = [...new Set((d.data.lop12 as PlanRecord[]).map((r) => r.week))].sort((a, b) => a - b);
          setWeek11(w11.includes(cw) ? cw : w11[0] ?? null);
          setWeek12(w12.includes(cw) ? cw : w12[0] ?? null);
          setStatus("");
        } else {
          setStatus("Chưa có báo giảng.");
        }
      })
      .catch(() => setStatus("Không tải được."));
  }, [currentWeek, initialData]);

  if (status) return <p style={{ textAlign: "center", padding: 24, color: "#64748b" }}>{status}</p>;
  if (!data) return null;

  return (
    <div className="tp-layout">
      <PlanPanel label="Lớp 11" records={data.lop11} week={week11} setWeek={setWeek11} />
      <PlanPanel label="Lớp 12" records={data.lop12} week={week12} setWeek={setWeek12} />
    </div>
  );
}
