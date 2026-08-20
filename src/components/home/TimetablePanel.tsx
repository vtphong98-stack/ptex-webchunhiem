"use client";

import { useEffect, useMemo, useState } from "react";

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

  if (!current) {
    return (
      <div className="site-widget">
        <p style={{ margin: 0 }}>GVCN chưa tải thời khóa biểu. Vào trang GVCN → TKB để tải lên.</p>
      </div>
    );
  }

  return (
    <div className="tkb-panel">
      {(stamp || options.length > 1) ? (
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
      ) : null}
      {selected ? (
        <Timetable afternoon={selected.afternoon} morning={selected.morning} todayIndex={todayIndex} />
      ) : null}
    </div>
  );
}
