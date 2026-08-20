import { YEAR_MILESTONES, type Milestone } from "@/lib/academic-calendar";

function startOfDay(iso: string) {
  return new Date(`${iso}T00:00:00+07:00`).getTime();
}

export function YearTimeline({ milestones }: { milestones?: Milestone[] }) {
  const list = milestones && milestones.length ? milestones : YEAR_MILESTONES;
  const now = Date.now();
  let activeIndex = list.findIndex((item, index) => {
    const start = startOfDay(item.iso);
    const next = list[index + 1];
    const end = next ? startOfDay(next.iso) : start + 86400000 * 14;
    return now >= start && now < end;
  });
  if (activeIndex < 0) {
    activeIndex = now < startOfDay(list[0]?.iso || "2026-08-24") ? 0 : list.length - 1;
  }

  return (
    <div className="year-timeline">
      {list.map((item, index) => {
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
