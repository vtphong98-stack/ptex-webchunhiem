import { AFTERNOON_TIMETABLE, DAY_LABELS, MORNING_TIMETABLE } from "@/lib/class-site";
import type { TimetableCell } from "@/lib/class-site";

function TimetableTable({
  title,
  periods,
  rows,
}: {
  title: string;
  periods: number[];
  rows: Record<number, TimetableCell[]>;
}) {
  return (
    <div className="site-table-wrap">
      <p className="session-title" style={{ fontWeight: 700, margin: "12px 0" }}>
        {title}
      </p>
      <table className="site-table">
        <thead>
          <tr>
            <th>Tiết</th>
            {DAY_LABELS.map((day) => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period}>
              <td>{period}</td>
              {rows[period].map((cell, index) =>
                cell.skip ? null : (
                  <td className={cell.className} data-tooltip={cell.teacher} key={`${period}-${index}`} rowSpan={cell.rowspan}>
                    {cell.subject}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Timetable() {
  return (
    <>
      <TimetableTable periods={[1, 2, 3, 4, 5]} rows={MORNING_TIMETABLE} title="Buổi Sáng (Áp dụng: 01-12-2025)" />
      <TimetableTable periods={[2, 3, 4, 5]} rows={AFTERNOON_TIMETABLE} title="Trái Buổi: Chiều" />
    </>
  );
}
