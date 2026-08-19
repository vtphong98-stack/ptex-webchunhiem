"use client";

import { useEffect, useState } from "react";

type NoticeRow = {
  _id: string;
  title: string;
  body: string;
  pinned: boolean;
  isNew: boolean;
  createdAt: string;
  dateLabel: string;
  authorName?: string;
};

export function NoticeBoard({ readOnly, yearName }: { readOnly: boolean; yearName: string }) {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function qs() {
    return yearName ? `?year=${encodeURIComponent(yearName)}` : "";
  }

  async function load() {
    const response = await fetch(`/api/gvcn/notices${qs()}`);
    if (!response.ok) {
      setMessage("Chưa tải được thông báo.");
      return;
    }
    const data = await response.json();
    setNotices(data.notices ?? []);
  }

  useEffect(() => {
    load().catch(() => setMessage("Chưa tải được thông báo."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearName]);

  function resetForm() {
    setTitle("");
    setBody("");
    setPinned(false);
    setEditingId("");
  }

  async function save() {
    if (!title.trim() || !body.trim()) {
      setMessage("Cần tiêu đề và nội dung thông báo.");
      return;
    }
    setPending(true);
    setMessage("");
    const payload = { title: title.trim(), body: body.trim(), pinned };
    const url = editingId ? `/api/gvcn/notices/${editingId}${qs()}` : `/api/gvcn/notices${qs()}`;
    const response = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(data.error || "Không lưu được thông báo.");
      return;
    }
    setMessage(editingId ? "Đã cập nhật thông báo." : "Đã đăng thông báo lên trang chủ.");
    resetForm();
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Xóa thông báo này khỏi trang chủ?")) return;
    const response = await fetch(`/api/gvcn/notices/${id}${qs()}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Không xóa được thông báo.");
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  function edit(notice: NoticeRow) {
    setEditingId(notice._id);
    setTitle(notice.title);
    setBody(notice.body);
    setPinned(notice.pinned);
    setMessage("");
  }

  return (
    <section className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-semibold">{editingId ? "Sửa thông báo" : "Đăng thông báo mới"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Thông báo hiện đầu trang chủ. Thông báo mới nhất và tin trong 7 ngày có nhãn <strong>NEW</strong>.
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Tiêu đề
          <input className="mt-1" disabled={readOnly} onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Nội dung
          <textarea
            className="mt-1 min-h-32 w-full rounded-xl border border-slate-200 p-3"
            disabled={readOnly}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
        </label>
        <label className="pin-check">
          <input checked={pinned} disabled={readOnly} onChange={(event) => setPinned(event.target.checked)} type="checkbox" />
          Ghim lên đầu danh sách
        </label>
        {message ? <p className="mt-3 text-sm text-amber-700">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="button-primary" disabled={pending || readOnly} onClick={() => void save()} type="button">
            {pending ? "Đang lưu…" : editingId ? "Cập nhật" : "Đăng lên trang chủ"}
          </button>
          {editingId ? (
            <button className="button-secondary" onClick={resetForm} type="button">
              Hủy sửa
            </button>
          ) : null}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Đã đăng ({notices.length})</h2>
        {!notices.length ? (
          <p className="text-sm text-slate-500">Chưa có thông báo năm này.</p>
        ) : (
          <ul className="space-y-3">
            {notices.map((notice) => (
              <li className="rounded-2xl bg-slate-50 p-4" key={notice._id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {notice.isNew ? <span className="gvcn-notice-new mr-2">NEW</span> : null}
                      {notice.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {notice.authorName ? `${notice.authorName} · ` : ""}
                      {notice.dateLabel}
                      {notice.pinned ? " · Đã ghim" : ""}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{notice.body}</p>
                  </div>
                  {readOnly ? null : (
                    <div className="flex gap-2">
                      <button className="button-secondary" onClick={() => edit(notice)} type="button">
                        Sửa
                      </button>
                      <button className="text-sm font-semibold text-red-600" onClick={() => void remove(notice._id)} type="button">
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
