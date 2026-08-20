"use client";

import { useEffect, useMemo, useRef } from "react";

import { buildWeeks2026, YEAR_MILESTONES, type Milestone } from "@/lib/academic-calendar";

import { getCurrentRealtimeWeek } from "@/lib/weeks";

export function SchoolWeekBadge({ milestones }: { milestones?: Milestone[] }) {
  const weekList = useMemo(() => buildWeeks2026(milestones), [milestones]);
  const week = useMemo(() => getCurrentRealtimeWeek(weekList), [weekList]);

  const hsgMilestone = useMemo(() => {
    const list = milestones && milestones.length ? milestones : YEAR_MILESTONES;
    const ms = list.find((m) => m.id === "hsg" || m.id?.includes("hsg"));
    if (!ms) return null;
    const target = new Date(`${ms.iso}T07:30:00`).getTime();
    if (target <= Date.now()) return null;
    return ms;
  }, [milestones]);

  const hsgRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!hsgMilestone) return;
    const target = new Date(`${hsgMilestone.iso}T07:30:00`).getTime();

    function update() {
      const el = hsgRef.current;
      if (!el) return;
      const diff = Math.max(target - Date.now(), 0);
      const days = Math.floor(diff / 86400000);
      el.textContent = `${days}`;
    }

    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [hsgMilestone]);

  const rangeShort = week?.dateRangeLabel
    ?.replace(/^từ ngày\s+/i, "")
    .replace(/\s+đến\s+/i, " – ") || "";

  if (!week && !hsgMilestone) return null;

  return (
    <div className="week-badge-bar">
      {week ? (
        <span className="week-badge">
          📅 {week.label} <span className="week-badge-range">{rangeShort}</span>
        </span>
      ) : null}
      {hsgMilestone ? (
        <span className="week-badge week-badge-hsg">
          ⭐ {hsgMilestone.label}: còn <span ref={hsgRef}>…</span> ngày
        </span>
      ) : null}
    </div>
  );
}
