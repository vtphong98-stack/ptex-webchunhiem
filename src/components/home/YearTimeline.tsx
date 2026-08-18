"use client";

import { YEAR_MILESTONES } from "@/lib/academic-calendar";

function startOfDay(iso: string) {
  return new Date(`${iso}T00:00:00+07:00`).getTime();
}

export function YearTimeline() {
  const now = Date.now();
  let activeIndex = YEAR_MILESTONES.findIndex((item, index) => {
    const start = startOfDay(item.iso);
    const next = YEAR_MILESTONES[index + 1];
    const end = next ? startOfDay(next.iso) : start + 86400000 * 14;
    return now >= start && now < end;
  });
  if (activeIndex < 0) {
    activeIndex = now < startOfDay(YEAR_MILESTONES[0].iso) ? 0 : YEAR_MILESTONES.length - 1;
  }

  return (
    <div className="year-timeline">
      {YEAR_MILESTONES.map((item, index) => {
        const past = now > startOfDay(item.iso) + 86400000;
        const active = index === activeIndex;
        return (
          <article className={`year-milestone${active ? " is-active" : ""}${past && !active ? " is-past" : ""}`} key={item.id}>
            <span className="year-milestone-dot" />
            <p className="year-milestone-date">{item.date}</p>
            <p className="year-milestone-label">{item.label}</p>
          </article>
        );
      })}
    </div>
  );
}
