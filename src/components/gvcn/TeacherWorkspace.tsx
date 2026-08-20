"use client";

import { useCallback, useEffect, useState } from "react";

import { buildWeeks2026 } from "@/lib/academic-calendar";
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

/* ─── TeacherTimetable (upload + view) ───── */
export function TeacherTimetable() {
  const [grid, setGrid] = useState<TimetableGrid | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [status, setStatus] = useState("Đang tải…");
  const [open, setOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/gvcn/teacher-timetable")
      .then(async (r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.data) { setGrid(d.data); setUpdatedAt(d.updatedAt || ""); setStatus(""); }
        else setStatus("Chưa có lịch dạy. Tải mẫu Excel, điền rồi upload.");
      })
      .catch(() => setStatus("Không tải được dữ liệu."));
  }, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setMsg("");
    const form = new FormData();
    form.set("file", file);
    const r = await fetch("/api/gvcn/teacher-timetable", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setUploading(false);
    if (!r.ok) { setMsg(d.error || "Upload thất bại."); return; }
    setUpdatedAt(d.updatedAt || "");
    setMsg("Đã cập nhật lịch dạy!");
    // Reload data
    const r2 = await fetch("/api/gvcn/teacher-timetable");
    const d2 = await r2.json().catch(() => null);
    if (d2?.data) { setGrid(d2.data); setStatus(""); }
  }

  return (
    <section className="tt-section">
      <h3 className="tt-toggle" onClick={() => setOpen(!open)}>
        📅 Lịch Dạy Giáo Viên
        <span className={`tt-chevron ${open ? "tt-chevron-open" : ""}`}>▼</span>
      </h3>
      {open && (
        <div className="tt-body">
          <div className="mt-2 flex flex-wrap gap-2 mb-3">
            <a className="button-secondary" href="/api/gvcn/teacher-timetable/template">Tải mẫu Excel</a>
            <label className={`button-primary ${uploading ? "opacity-50" : ""}`} style={{ cursor: "pointer" }}>
              {uploading ? "Đang tải…" : "Upload lịch dạy"}
              <input type="file" accept=".xlsx,.xls" hidden disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
          {updatedAt ? <p className="text-sm text-indigo-700 font-semibold mb-2">Cập nhật: {formatDateTime(updatedAt)}</p> : null}
          {msg ? <p className={`text-sm mb-2 ${msg.includes("thất bại") || msg.includes("Lỗi") ? "text-red-600" : "text-green-700"}`}>{msg}</p> : null}
          {status ? <p className="tt-status">{status}</p> : null}
          {grid ? (
            <>
              <TimetableTable title="Buổi Sáng" data={grid.morning} />
              <TimetableTable title="Buổi Chiều" data={grid.afternoon} />
              <TimetableTable title="Buổi Tối" data={grid.evening} />
            </>
          ) : null}
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
