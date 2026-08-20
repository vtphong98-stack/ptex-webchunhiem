import {
  AFTERNOON_TIMETABLE,
  CLASS_SITE,
  DAY_LABELS,
  MORNING_TIMETABLE,
  shortTeacherName,
  subjectStyle,
} from "@/lib/class-site";
import type { TimetableCell } from "@/lib/class-site";

function TimetableTable({
  title,
  badge,
  periods,
  rows,
  todayIndex,
}: {
  title: string;
  badge: string;
  periods: number[];
  rows: Record<number, TimetableCell[]>;
  /** 0 = thứ Hai … 5 = thứ Bảy; null khi chưa biết (lúc render trên server). */
  todayIndex: number | null;
}) {
  return (
    <div className="site-table-wrap">
      <p className="tkb-session">
        {title}
        <span>{badge}</span>
      </p>
      <table className="site-table">
        <thead>
          <tr>
            <th scope="col">Tiết</th>
            {DAY_LABELS.map((day, index) => (
              <th className={index === todayIndex ? "is-today" : undefined} key={day} scope="col">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period}>
              <th scope="row">{period}</th>
              {rows[period]?.map((cell, index) => {
                if (cell.skip) return null;
                const style = subjectStyle(cell.subject);
                const teacher = cell.teacher || style.teacher;
                const empty = cell.subject === "-" || !cell.subject;
                return (
                  <td
                    className={[
                      empty ? "subject-empty" : cell.className || style.className,
                      index === todayIndex ? "is-today-col" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={`${period}-${index}`}
                    rowSpan={cell.rowspan}
                  >
                    {empty ? "–" : cell.subject}
                    {!empty && teacher ? (
                      <span className="tkb-teacher" title={teacher}>
                        {shortTeacherName(teacher)}
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Timetable({
  morning = MORNING_TIMETABLE,
  afternoon = AFTERNOON_TIMETABLE,
  todayIndex = null,
}: {
  morning?: Record<number, TimetableCell[]>;
  afternoon?: Record<number, TimetableCell[]>;
  todayIndex?: number | null;
}) {
  return (
    <>
      <TimetableTable
        badge="Tiết 1–5"
        periods={[1, 2, 3, 4, 5]}
        rows={morning}
        title={CLASS_SITE.morningTitle}
        todayIndex={todayIndex}
      />
      <TimetableTable
        badge="Tiết 2–5"
        periods={[2, 3, 4, 5]}
        rows={afternoon}
        title={CLASS_SITE.afternoonTitle}
        todayIndex={todayIndex}
      />
    </>
  );
}
