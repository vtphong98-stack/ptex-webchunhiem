import { YEAR_MILESTONES, type Milestone } from "@/lib/academic-calendar";

const DAY = 86400000;

/** Nửa đêm giờ Việt Nam, không phụ thuộc múi giờ của máy chủ. */
function startOfDay(iso: string) {
  return new Date(`${iso}T00:00:00+07:00`).getTime();
}

/**
 * Bốn trạng thái của một mốc trong năm:
 *
 * - `today`   đúng hôm nay, màu cam đỏ, chấm nhấp nháy
 * - `next`    mốc kế tiếp sắp tới, màu tím nhấn, kèm số ngày còn lại
 * - `upcoming` các mốc xa hơn, để trắng
 * - `done`    đã qua, xám lại và tụt xuống cuối hàng
 */
type MilestoneState = "done" | "today" | "next" | "upcoming";

function stateLabel(state: MilestoneState, daysLeft: number) {
  if (state === "done") return "Đã thực hiện";
  if (state === "today") return "Hôm nay";
  if (state !== "next") return "";
  if (daysLeft <= 1) return "Ngày mai";
  return `Còn ${daysLeft} ngày`;
}

export function YearTimeline({ milestones }: { milestones?: Milestone[] }) {
  const list = milestones && milestones.length ? milestones : YEAR_MILESTONES;
  const now = Date.now();

  const marked = list.map((item) => {
    const start = startOfDay(item.iso);
    const done = now >= start + DAY;
    return {
      item,
      start,
      done,
      today: !done && now >= start,
      daysLeft: Math.ceil((start - now) / DAY),
    };
  });

  // Mốc đã qua tụt xuống cuối để phần sắp tới luôn nằm ngay đầu hàng; trong mỗi
  // nhóm vẫn giữ đúng thứ tự ngày.
  const ahead = marked.filter((entry) => !entry.done).sort((a, b) => a.start - b.start);
  const behind = marked.filter((entry) => entry.done).sort((a, b) => a.start - b.start);
  const nextId = ahead.find((entry) => !entry.today)?.item.id ?? "";

  return (
    <div className="year-timeline">
      {[...ahead, ...behind].map((entry) => {
        const state: MilestoneState = entry.done
          ? "done"
          : entry.today
            ? "today"
            : entry.item.id === nextId
              ? "next"
              : "upcoming";
        const note = stateLabel(state, entry.daysLeft);
        return (
          <article className={`year-milestone is-${state}`} key={entry.item.id}>
            <span className="year-milestone-dot" />
            <p className="year-milestone-date">{entry.item.date}</p>
            <p className="year-milestone-label">{entry.item.label}</p>
            {note ? <p className="year-milestone-state">{note}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
