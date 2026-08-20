"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Timetable } from "@/components/home/Timetable";
import type { TimetableCell } from "@/lib/class-site";
import { CLASS_SITE } from "@/lib/class-site";
import { downloadBlob, readSubjectPalette, renderTimetablePng } from "@/lib/timetable-image";
import { formatDateTime } from "@/lib/utils";

export type TimetableSnapshot = {
  id: string;
  createdAt: string;
  current?: boolean;
  morning: Record<number, TimetableCell[]>;
  afternoon: Record<number, TimetableCell[]>;
};

export function TimetablePanel({
  current,
  versions,
}: {
  current: TimetableSnapshot | null;
  versions: TimetableSnapshot[];
}) {
  const [selectedId, setSelectedId] = useState("current");
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  // Set after mount so the server-rendered HTML has no weekday in it — otherwise
  // the highlight would differ between server and client across midnight.
  const [todayIndex, setTodayIndex] = useState<number | null>(null);

  useEffect(() => {
    const weekday = new Date().getDay(); // 0 = CN
    setTodayIndex(weekday === 0 ? null : weekday - 1);
  }, []);

  const options = useMemo(() => {
    const rows: Array<{ id: string; label: string }> = [];
    if (current?.createdAt) {
      rows.push({ id: "current", label: `Bản hiện hành · ${formatDateTime(current.createdAt)}` });
    } else {
      rows.push({ id: "current", label: "Bản hiện hành" });
    }
    for (const version of versions) {
      rows.push({ id: version.id, label: `Bản cũ · ${formatDateTime(version.createdAt)}` });
    }
    return rows;
  }, [current, versions]);

  const selected =
    selectedId === "current" ? current : versions.find((item) => item.id === selectedId) || current;
  const viewingOld = selectedId !== "current";
  const stamp = selected?.createdAt || current?.createdAt || "";

  const saveImage = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    setSaveNote("");
    try {
      const blob = await renderTimetablePng({
        sessions: [
          { title: CLASS_SITE.morningTitle, periods: [1, 2, 3, 4, 5], rows: selected.morning },
          { title: CLASS_SITE.afternoonTitle, periods: [2, 3, 4, 5], rows: selected.afternoon },
        ],
        palette: readSubjectPalette(tableRef.current),
        className: CLASS_SITE.className,
        schoolYear: CLASS_SITE.schoolYear,
        updatedAt: stamp ? formatDateTime(stamp) : "",
      });
      if (!blob) {
        setSaveNote("Máy không hỗ trợ lưu ảnh. Thử trình duyệt khác.");
        return;
      }
      downloadBlob(blob, `TKB-${CLASS_SITE.className}-${CLASS_SITE.schoolYear}.png`);
      setSaveNote("Đã lưu ảnh vào máy.");
      window.setTimeout(() => setSaveNote(""), 4000);
    } catch {
      setSaveNote("Không lưu được ảnh. Thử lại.");
    } finally {
      setSaving(false);
    }
  }, [selected, stamp]);

  if (!current) {
    return (
      <div className="site-widget">
        <p style={{ margin: 0 }}>GVCN chưa tải thời khóa biểu. Vào trang GVCN → TKB để tải lên.</p>
      </div>
    );
  }

  return (
    <div className="tkb-panel">
      {selected ? (
        <div className="tkb-toolbar">
          {/* Chỉ hiện nhãn khi thật sự có mốc thời gian — trước đây nó luôn in
              "Cập nhật:" rồi để trống. */}
          {stamp ? (
            <p className="tkb-updated">
              {viewingOld ? "Đang xem bản cũ" : "Cập nhật"} <strong>{formatDateTime(stamp)}</strong>
            </p>
          ) : (
            <span />
          )}
          <div className="tkb-tools">
            {options.length > 1 ? (
              <label className="tkb-version">
                Phiên bản
                <select onChange={(event) => setSelectedId(event.target.value)} value={selectedId}>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className="tkb-save" disabled={saving} onClick={() => void saveImage()} type="button">
              <span aria-hidden>🖼️</span>
              {saving ? "Đang tạo ảnh…" : "Lưu ảnh TKB"}
            </button>
          </div>
        </div>
      ) : null}
      {saveNote ? <p className="tkb-save-note">{saveNote}</p> : null}
      <div ref={tableRef}>
        {selected ? (
          <Timetable afternoon={selected.afternoon} morning={selected.morning} todayIndex={todayIndex} />
        ) : null}
      </div>
    </div>
  );
}
