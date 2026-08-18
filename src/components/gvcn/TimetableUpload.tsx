"use client";

import { useState } from "react";

export function TimetableUpload({ readOnly, yearName }: { readOnly: boolean; yearName: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    if (yearName) form.set("year", yearName);
    const response = await fetch("/api/gvcn/timetable", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    setMessage(response.ok ? "Đã cập nhật thời khóa biểu trên trang chủ." : data.error || "Không tải được file.");
  }

  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold">Thời khóa biểu</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Tải mẫu Excel, gõ môn theo cột thứ Hai–Bảy (sheet Sáng tiết 1–5, sheet Chiều tiết 2–5), rồi tải lên.
        Web tô màu môn và gộp ô giống trang chủ.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="button-secondary" href="/api/gvcn/timetable/template">
          Tải mẫu Excel TKB
        </a>
        {readOnly ? (
          <span className="text-sm text-slate-500">Năm cũ chỉ xem — không ghi đè TKB.</span>
        ) : (
          <label className="button-primary cursor-pointer">
            {pending ? "Đang tải…" : "Tải TKB lên"}
            <input
              accept=".xlsx,.xls"
              className="hidden"
              disabled={pending}
              onChange={(event) => {
                upload(event.target.files?.[0]).catch(() => setMessage("Không tải được file."));
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        )}
        <a className="button-secondary" href="/">
          Xem trên trang chủ
        </a>
      </div>
      {message ? <p className="mt-3 text-sm text-amber-700">{message}</p> : null}
    </section>
  );
}
