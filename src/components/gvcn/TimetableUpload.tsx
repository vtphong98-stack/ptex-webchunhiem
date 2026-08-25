"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatDateTime } from "@/lib/utils";

type VersionRow = { id: string; createdAt: string; createdByName?: string };

export function TimetableUpload({ readOnly, yearName }: { readOnly: boolean; yearName: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({});

  function qs() {
    return yearName ? `?year=${encodeURIComponent(yearName)}` : "";
  }

  async function load() {
    const response = await fetch(`/api/gvcn/timetable${qs()}`);
    if (!response.ok) return;
    const data = await response.json();
    setUpdatedAt(data.updatedAt || "");
    setVersions(Array.isArray(data.versions) ? data.versions : []);
    setTeachers(data.teachers ?? {});
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearName]);

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
    if (!response.ok) {
      setMessage(data.error || "Không tải được file.");
      return;
    }
    setUpdatedAt(data.updatedAt || "");
    setVersions(Array.isArray(data.versions) ? data.versions : []);
    const nextTeachers: Record<string, string> = data.teachers ?? {};
    setTeachers(nextTeachers);
    const teacherCount = Object.keys(nextTeachers).length;
    setMessage(
      teacherCount
        ? `Đã cập nhật thời khóa biểu, nhận được tên giáo viên của ${teacherCount} môn. Bản trước được lưu để xem lại trên trang chủ.`
        : "Đã cập nhật thời khóa biểu. File chưa có sheet \"Giáo viên\" nên trang chủ chỉ hiện tên môn.",
    );
  }

  async function remove(id: string) {
    if (!window.confirm("Xóa phiên bản thời khóa biểu cũ này? Không thể hoàn tác.")) return;
    const response = await fetch(`/api/gvcn/timetable/${id}${qs()}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Không xóa được phiên bản cũ.");
      return;
    }
    setVersions(Array.isArray(data.versions) ? data.versions : []);
    setMessage("Đã xóa phiên bản cũ.");
  }

  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold">Thời khóa biểu</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Tải mẫu Excel, gõ môn theo cột thứ Hai–Bảy (sheet Sáng tiết 1–5, sheet Chiều tiết 2–5), điền tên thầy cô
        từng môn ở sheet <b>Giáo viên</b>, rồi tải lên — trang chủ sẽ hiện cả tên môn lẫn tên giáo viên. Mẫu tải về
        đã có sẵn thời khóa biểu và phân công đang dùng. Mỗi lần cập nhật, bản cũ được lưu để xem lại.
      </p>
      {updatedAt ? (
        <p className="mt-3 text-sm font-semibold text-indigo-700">Bản hiện hành cập nhật {formatDateTime(updatedAt)}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Chưa có thời khóa biểu năm này.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="button-secondary" href={`/api/gvcn/timetable/template${qs()}`}>
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
        <Link className="button-secondary" href="/">
          Xem trên trang chủ
        </Link>
      </div>
      {message ? <p className="mt-3 text-sm text-amber-700">{message}</p> : null}

      <h3 className="mt-6 text-base font-semibold">Giáo viên bộ môn</h3>
      {!Object.keys(teachers).length ? (
        <p className="mt-2 text-sm text-slate-500">
          Chưa có phân công. Điền sheet <b>Giáo viên</b> trong file mẫu rồi tải lên, hoặc gõ thẳng vào ô theo kiểu
          &quot;Toán: Võ Thanh Phong&quot;.
        </p>
      ) : (
        <ul className="tkb-teachers">
          {Object.entries(teachers)
            .sort(([a], [b]) => a.localeCompare(b, "vi"))
            .map(([subject, teacher]) => (
              <li key={subject}>
                <strong>{subject}</strong>
                <span>{teacher}</span>
              </li>
            ))}
        </ul>
      )}

      <h3 className="mt-6 text-base font-semibold">Phiên bản cũ</h3>
      {!versions.length ? (
        <p className="mt-2 text-sm text-slate-500">Chưa có bản cũ. Tải TKB mới thì bản đang dùng sẽ vào đây.</p>
      ) : (
        <ul className="tkb-history">
          {versions.map((version) => (
            <li key={version.id}>
              <div>
                <strong>{formatDateTime(version.createdAt)}</strong>
                {version.createdByName ? <span> · {version.createdByName}</span> : null}
              </div>
              {readOnly ? null : (
                <button className="button-secondary" onClick={() => void remove(version.id)} type="button">
                  Xóa
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
