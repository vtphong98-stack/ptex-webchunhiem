"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TimetableGridEditor } from "@/components/gvcn/TimetableGridEditor";
import { emptyTimetableGrid, type TimetableGrid } from "@/lib/excel-timetable";
import { formatDateTime } from "@/lib/utils";

type VersionRow = { id: string; createdAt: string; createdByName?: string };

export function TimetableUpload({ readOnly, yearName }: { readOnly: boolean; yearName: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"excel" | "type">("type");
  const [grid, setGrid] = useState<TimetableGrid>(() => emptyTimetableGrid());
  /** Lưới đã sửa nhưng chưa bấm lưu — dùng để nhắc và để bật nút Lưu. */
  const [dirty, setDirty] = useState(false);

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
    if (data.grid) setGrid(data.grid);
    setDirty(false);
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
    // Đổ luôn sang bảng gõ trực tiếp: nhập file xong muốn sửa một tiết thì sửa
    // ngay tại chỗ, khỏi mở lại Excel rồi tải lên lần nữa.
    if (data.grid) setGrid(data.grid);
    setDirty(false);
    const teacherCount = Object.keys(nextTeachers).length;
    setMessage(
      teacherCount
        ? `Đã cập nhật thời khóa biểu, nhận được tên giáo viên của ${teacherCount} môn. Bảng "Gõ trực tiếp" đã lấy sẵn dữ liệu này để sửa tiếp.`
        : "Đã cập nhật thời khóa biểu. File chưa có sheet \"Giáo viên\" nên trang chủ chỉ hiện tên môn — điền ở tab \"Gõ trực tiếp\" cũng được.",
    );
  }

  async function saveGrid() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/gvcn/timetable", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid, ...(yearName ? { year: yearName } : {}) }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(data.error || "Không lưu được thời khóa biểu.");
      return;
    }
    setUpdatedAt(data.updatedAt || "");
    setVersions(Array.isArray(data.versions) ? data.versions : []);
    setTeachers(data.teachers ?? {});
    if (data.grid) setGrid(data.grid);
    setDirty(false);
    const teacherCount = Object.keys(data.teachers ?? {}).length;
    setMessage(
      teacherCount
        ? `Đã lưu thời khóa biểu, kèm tên giáo viên của ${teacherCount} môn. Trang chủ cập nhật ngay.`
        : "Đã lưu thời khóa biểu. Điền thêm tên giáo viên thì trang chủ hiện luôn tên và nút gọi.",
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
        Hai cách nhập, chọn cách nào cũng được: <b>gõ trực tiếp</b> ngay trên trang này, hoặc <b>nhập bằng file
        Excel</b> nếu trường đã gửi sẵn file. Cả hai đều nhận tên giáo viên và số điện thoại từng môn — điền vào
        thì trang chủ hiện tên thầy cô và bấm vào ô là gọi hoặc Zalo được. Mỗi lần cập nhật, bản cũ được lưu để
        xem lại.
      </p>
      {updatedAt ? (
        <p className="mt-3 text-sm font-semibold text-indigo-700">Bản hiện hành cập nhật {formatDateTime(updatedAt)}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Chưa có thời khóa biểu năm này.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
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
          Nhập bằng file Excel
        </button>
        <Link className="button-secondary" href="/">
          Xem trên trang chủ
        </Link>
      </div>

      {mode === "excel" ? (
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
        </div>
      ) : (
        <div className="mt-4">
          <TimetableGridEditor
            grid={grid}
            onChange={(next) => {
              setGrid(next);
              setDirty(true);
            }}
            readOnly={readOnly}
          />
          {readOnly ? null : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="button-primary" disabled={pending || !dirty} onClick={() => void saveGrid()} type="button">
                {pending ? "Đang lưu…" : "Lưu thời khóa biểu"}
              </button>
              <button
                className="button-secondary"
                disabled={pending || !dirty}
                onClick={() => void load()}
                type="button"
              >
                Hoàn tác
              </button>
              {dirty ? <span className="text-sm text-amber-700">Có thay đổi chưa lưu.</span> : null}
            </div>
          )}
        </div>
      )}

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
