"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_PENALTY,
  SUGGESTED_EVENTS,
  countEvent,
  formatEventDate,
  summariseAbsences,
  type AttendanceEvent,
  type AttendanceMark,
} from "@/lib/attendance";

type RosterStudent = { id: string; tt: number | null; fullName: string; teamNumber: number | null };

type Draft = { marks: Record<string, AttendanceMark>; excused: string[] };

function todayIso() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Mở một dịp ra thì mặc định cả lớp có mặt: GVCN chỉ tích lại vài em vắng thay
 * vì bấm đủ 42 lần. Dịp đã điểm danh rồi thì lấy đúng bản đã lưu.
 */
function seedDraft(event: AttendanceEvent, students: RosterStudent[]): Draft {
  const marks: Record<string, AttendanceMark> = {};
  for (const student of students) {
    marks[student.id] = event.marks?.[student.id] ?? "present";
  }
  return { marks, excused: [...(event.excused ?? [])] };
}

function sameDraft(a: Draft, b: Draft) {
  const keys = new Set([...Object.keys(a.marks), ...Object.keys(b.marks)]);
  for (const key of keys) if (a.marks[key] !== b.marks[key]) return false;
  return [...a.excused].sort().join("|") === [...b.excused].sort().join("|");
}

export function AttendanceManager({ readOnly, yearName }: { readOnly: boolean; yearName: string }) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [openId, setOpenId] = useState("");
  // Giữ bản nháp theo từng dịp thay vì dựng lại trong useEffect: đổi qua đổi
  // lại giữa các dịp không mất thứ đang tích dở, và không có vòng render thừa.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", date: "", penalty: String(DEFAULT_PENALTY) });
  const [adding, setAdding] = useState(false);

  const qs = yearName ? `?year=${encodeURIComponent(yearName)}` : "";

  // Không bật cờ loading ở đầu: nó đã bật sẵn từ lúc dựng, mà đặt state ngay
  // trong thân effect thì React than phiền về vòng render thừa.
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/gvcn/attendance${qs}`);
      if (!response.ok) throw new Error("load");
      const data = (await response.json()) as { students: RosterStudent[]; events: AttendanceEvent[] };
      setStudents(data.students ?? []);
      setEvents(data.events ?? []);
      // Dịp chưa chốt gần nhất là dịp đang làm dở; hết rồi thì lấy dịp mới nhất.
      const list = data.events ?? [];
      const current = list.find((event) => !event.closed) ?? list[0];
      setOpenId(current?._id ?? "");
      // Đặt ngày mặc định ở đây chứ không phải lúc dựng: máy chủ chạy giờ UTC,
      // sáng sớm giờ Việt Nam hai bên lệch nhau một ngày.
      setForm((form) => (form.date ? form : { ...form, date: todayIso() }));
    } catch {
      setMsg({ type: "err", text: "Chưa tải được sổ điểm danh. Tải lại trang giúp thầy cô nhé." });
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEvent = useMemo(() => events.find((event) => event._id === openId) ?? null, [events, openId]);

  // Bản đã lưu của dịp đang mở; bản nháp chỉ tồn tại khi GVCN đã đụng vào.
  const saved = useMemo(
    () => (openEvent && students.length ? seedDraft(openEvent, students) : null),
    [openEvent, students],
  );
  const draft = openEvent ? (drafts[openEvent._id] ?? saved) : null;
  const dirty = Boolean(draft && saved && !sameDraft(draft, saved));
  const locked = readOnly || Boolean(openEvent?.closed);

  const tally = useMemo(() => {
    if (!draft) return { present: 0, absent: 0, excused: 0 };
    let present = 0;
    let absent = 0;
    for (const student of students) {
      if (draft.marks[student.id] === "absent") absent += 1;
      else present += 1;
    }
    return { present, absent, excused: draft.excused.length };
  }, [draft, students]);

  const absenceSummary = useMemo(() => summariseAbsences(events), [events]);
  const summaryRows = useMemo(() => {
    return students
      .map((student) => ({ student, row: absenceSummary.get(student.id) }))
      .filter((entry) => entry.row && entry.row.absent > 0)
      .sort((a, b) => (b.row?.penalty ?? 0) - (a.row?.penalty ?? 0) || (b.row?.absent ?? 0) - (a.row?.absent ?? 0));
  }, [students, absenceSummary]);

  function editDraft(change: (current: Draft) => Draft) {
    if (!openEvent || !draft) return;
    const next = change(draft);
    setDrafts((current) => ({ ...current, [openEvent._id]: next }));
  }

  function setMark(studentId: string, mark: AttendanceMark) {
    editDraft((current) => ({
      marks: { ...current.marks, [studentId]: mark },
      // Chuyển về có mặt thì bỏ luôn dấu "có phép", khỏi treo lại dữ liệu cũ.
      excused: mark === "absent" ? current.excused : current.excused.filter((id) => id !== studentId),
    }));
  }

  function toggleExcused(studentId: string) {
    editDraft((current) => ({
      marks: current.marks,
      excused: current.excused.includes(studentId)
        ? current.excused.filter((id) => id !== studentId)
        : [...current.excused, studentId],
    }));
  }

  function markAll(mark: AttendanceMark) {
    editDraft((current) => {
      const marks: Record<string, AttendanceMark> = {};
      for (const student of students) marks[student.id] = mark;
      return { marks, excused: mark === "absent" ? current.excused : [] };
    });
  }

  async function addEvent() {
    if (readOnly) return;
    const name = form.name.trim();
    if (!name) {
      setMsg({ type: "err", text: "Đặt tên cho dịp điểm danh đã." });
      return;
    }
    setAdding(true);
    setMsg(null);
    try {
      const response = await fetch(`/api/gvcn/attendance${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date: form.date, penalty: Number(form.penalty) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMsg({ type: "err", text: data.error || "Không thêm được dịp điểm danh." });
        return;
      }
      setEvents((current) => [data.event, ...current]);
      setOpenId(data.event._id);
      setForm({ name: "", date: todayIso(), penalty: String(DEFAULT_PENALTY) });
      setMsg({ type: "ok", text: `Đã thêm dịp "${name}". Cả lớp đang để mặc định có mặt.` });
    } catch {
      setMsg({ type: "err", text: "Không kết nối được máy chủ." });
    } finally {
      setAdding(false);
    }
  }

  async function save() {
    if (!openEvent || !draft || locked) return;
    setBusy(true);
    setMsg(null);
    try {
      const response = await fetch(`/api/gvcn/attendance/${openEvent._id}${qs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMsg({ type: "err", text: data.error || "Không lưu được." });
        return;
      }
      setEvents((current) =>
        current.map((event) =>
          event._id === openEvent._id
            ? { ...event, marks: data.marks, excused: data.excused, updatedAt: data.updatedAt }
            : event,
        ),
      );
      // Bỏ bản nháp đi: từ giờ bản đã lưu chính là bản đang hiện, nút Lưu tắt.
      setDrafts((current) => {
        const next = { ...current };
        delete next[openEvent._id];
        return next;
      });
      setMsg({ type: "ok", text: `Đã lưu: có mặt ${tally.present}, vắng ${tally.absent}.` });
    } catch {
      setMsg({ type: "err", text: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  async function setClosed(closed: boolean) {
    if (!openEvent || readOnly) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/gvcn/attendance/${openEvent._id}${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMsg({ type: "err", text: data.error || "Không đổi được trạng thái." });
        return;
      }
      setEvents((current) =>
        current.map((event) => (event._id === openEvent._id ? { ...event, closed } : event)),
      );
      setMsg({
        type: "ok",
        text: closed ? "Đã chốt dịp này. Muốn sửa thì mở lại." : "Đã mở lại, sửa được rồi.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent() {
    if (!openEvent || readOnly) return;
    if (!confirm(`Xóa hẳn dịp "${openEvent.name}" và toàn bộ điểm danh của dịp này?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/gvcn/attendance/${openEvent._id}${qs}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMsg({ type: "err", text: data.error || "Không xóa được." });
        return;
      }
      const rest = events.filter((event) => event._id !== openEvent._id);
      setEvents(rest);
      setOpenId((rest.find((event) => !event.closed) ?? rest[0])?._id ?? "");
      setMsg({ type: "ok", text: "Đã xóa dịp điểm danh." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="card p-6 text-center text-slate-500">Đang tải sổ điểm danh…</div>;
  }

  return (
    <section className="card ct-root space-y-5">
      <header className="ct-head border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">✅ Điểm danh theo dịp</h2>
          <p className="text-sm text-slate-500 mt-1">
            Lao động, khai giảng, 20/11, tổng kết… Số buổi vắng không phép cộng dồn cả năm là căn cứ hạ hạnh
            kiểm.
          </p>
        </div>
        <span className="ct-chip">{events.length} dịp</span>
      </header>

      {msg ? (
        <p className={`dd-msg ${msg.type === "ok" ? "is-ok" : "is-err"}`}>{msg.text}</p>
      ) : null}

      {/* ── Thêm dịp ─────────────────────────────────────────────── */}
      {!readOnly ? (
        <div className="dd-new">
          <div className="ct-field">
            <span>Tên dịp:</span>
            <input
              autoComplete="off"
              list="dd-suggest"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="VD: Lao động tập trung"
              type="text"
              value={form.name}
            />
            <datalist id="dd-suggest">
              {SUGGESTED_EVENTS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="ct-field">
            <span>Ngày:</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={form.date}
            />
          </div>
          <div className="ct-field">
            <span>Vắng trừ:</span>
            <input
              className="ct-num"
              max={10}
              min={0}
              onChange={(event) => setForm((current) => ({ ...current, penalty: event.target.value }))}
              type="number"
              value={form.penalty}
            />
            <span>điểm</span>
          </div>
          <button className="button-primary" disabled={adding} onClick={() => void addEvent()} type="button">
            {adding ? "Đang thêm…" : "➕ Thêm dịp"}
          </button>
          <div className="dd-quick">
            {SUGGESTED_EVENTS.slice(0, 5).map((name) => (
              <button
                key={name}
                onClick={() => setForm((current) => ({ ...current, name }))}
                type="button"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Danh sách dịp ────────────────────────────────────────── */}
      {!events.length ? (
        <p className="dd-empty">Chưa có dịp nào. Thêm dịp đầu tiên ở trên rồi điểm danh.</p>
      ) : (
        <div className="dd-events">
          {events.map((event) => {
            const count = countEvent(event);
            return (
              <button
                className={`dd-event${event._id === openId ? " is-open" : ""}${event.closed ? " is-closed" : ""}`}
                key={event._id}
                onClick={() => setOpenId(event._id)}
                type="button"
              >
                <strong>{event.name}</strong>
                <span className="dd-event-date">{formatEventDate(event.date)}</span>
                <span className="dd-event-tally">
                  {count.marked
                    ? `Vắng ${count.absent}/${count.marked}`
                    : "Chưa điểm danh"}
                  {event.closed ? " · đã chốt" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Bảng điểm danh ───────────────────────────────────────── */}
      {openEvent && draft ? (
        <div className="dd-sheet">
          <div className="ct-head dd-sheet-head">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                {openEvent.name} · {formatEventDate(openEvent.date)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Vắng không phép trừ {openEvent.penalty} điểm · mặc định cả lớp có mặt, chỉ tích em nào vắng.
              </p>
            </div>
            <span className="dd-count">
              Có mặt <b>{tally.present}</b> · Vắng <b className="is-absent">{tally.absent}</b>
              {tally.excused ? <em> ({tally.excused} có phép)</em> : null}
            </span>
          </div>

          {!locked ? (
            <div className="dd-bulk">
              <button className="button-secondary" onClick={() => markAll("present")} type="button">
                ✓ Tất cả có mặt
              </button>
              <button className="button-secondary" onClick={() => markAll("absent")} type="button">
                ✕ Tất cả vắng
              </button>
            </div>
          ) : (
            <p className="dd-locked">
              {readOnly ? "Năm cũ chỉ xem." : "Dịp này đã chốt — mở lại mới sửa được."}
            </p>
          )}

          <div className="dd-table">
            <div className="dd-row dd-row-head">
              <span>Học sinh</span>
              <span>Có mặt</span>
              <span>Vắng</span>
            </div>
            {students.map((student) => {
              const mark = draft.marks[student.id] ?? "present";
              const isExcused = draft.excused.includes(student.id);
              return (
                <div className={`dd-row${mark === "absent" ? " is-absent" : ""}`} key={student.id}>
                  <span className="dd-name">
                    <b>{student.tt ?? "•"}</b>
                    {student.fullName}
                    {mark === "absent" && !locked ? (
                      <label className={`dd-excused${isExcused ? " is-on" : ""}`}>
                        <input
                          checked={isExcused}
                          onChange={() => toggleExcused(student.id)}
                          type="checkbox"
                        />
                        có phép
                      </label>
                    ) : null}
                    {mark === "absent" && locked && isExcused ? <em className="dd-excused-tag">có phép</em> : null}
                  </span>
                  <label className={`dd-tick is-present${mark === "present" ? " is-on" : ""}`}>
                    <input
                      checked={mark === "present"}
                      disabled={locked}
                      name={`dd-${student.id}`}
                      onChange={() => setMark(student.id, "present")}
                      type="radio"
                    />
                  </label>
                  <label className={`dd-tick is-away${mark === "absent" ? " is-on" : ""}`}>
                    <input
                      checked={mark === "absent"}
                      disabled={locked}
                      name={`dd-${student.id}`}
                      onChange={() => setMark(student.id, "absent")}
                      type="radio"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {!readOnly ? (
            <div className="dd-actions">
              {!openEvent.closed ? (
                <>
                  <button
                    className="button-primary"
                    disabled={busy || !dirty}
                    onClick={() => void save()}
                    type="button"
                  >
                    {busy ? "Đang lưu…" : dirty ? "💾 Lưu điểm danh" : "Đã lưu"}
                  </button>
                  <button
                    className="button-secondary"
                    disabled={busy || dirty}
                    onClick={() => void setClosed(true)}
                    title={dirty ? "Lưu trước đã" : "Khoá dịp này lại"}
                    type="button"
                  >
                    🔒 Chốt dịp này
                  </button>
                </>
              ) : (
                <button
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => void setClosed(false)}
                  type="button"
                >
                  🔓 Mở lại để sửa
                </button>
              )}
              <button className="dd-remove" disabled={busy} onClick={() => void removeEvent()} type="button">
                🗑️ Xóa dịp
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Tổng hợp cả năm ──────────────────────────────────────── */}
      <div className="dd-summary">
        <div className="ct-head border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">📋 Tổng hợp vắng cả năm</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cộng từ mọi dịp đã điểm danh — dùng thẳng cho xét hạnh kiểm.
            </p>
          </div>
          <span className="ct-chip">{summaryRows.length} em có vắng</span>
        </div>

        {!summaryRows.length ? (
          <p className="dd-empty">Chưa em nào vắng buổi nào. Cả lớp đủ mặt.</p>
        ) : (
          <div className="dd-table dd-table-sum">
            <div className="dd-row dd-row-head">
              <span>Học sinh</span>
              <span>Vắng</span>
              <span>Trừ</span>
            </div>
            {summaryRows.map(({ student, row }) => (
              <div className="dd-row" key={student.id}>
                <span className="dd-name">
                  <b>{student.tt ?? "•"}</b>
                  {student.fullName}
                </span>
                <span className="dd-sum-count">
                  {row?.absent}
                  {row?.excused ? <em> ({row.excused} phép)</em> : null}
                </span>
                <span className={`dd-sum-penalty${(row?.penalty ?? 0) > 0 ? " is-hot" : ""}`}>
                  {row?.penalty ? `−${row.penalty}` : "0"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
