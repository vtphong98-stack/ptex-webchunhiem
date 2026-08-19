"use client";

import { useMemo, useState } from "react";

import { Timetable } from "@/components/home/Timetable";
import type { TimetableCell } from "@/lib/class-site";
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

  if (!current) {
    return (
      <div className="site-widget">
        <p style={{ margin: 0 }}>GVCN chưa tải thời khóa biểu. Vào trang GVCN → TKB để tải lên.</p>
      </div>
    );
  }

  return (
    <div className="tkb-panel">
      <div className="tkb-toolbar">
        <p className="tkb-updated">
          {viewingOld ? "Đang xem bản cũ" : "Cập nhật"}:{" "}
          <strong>{formatDateTime(selected?.createdAt || current.createdAt)}</strong>
        </p>
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
      </div>
      {selected ? <Timetable afternoon={selected.afternoon} morning={selected.morning} /> : null}
    </div>
  );
}
