"use client";

import { useState } from "react";

import {
  AFTERNOON_TIMETABLE,
  CLASS_SITE,
  DAY_LABELS,
  MORNING_TIMETABLE,
  shortTeacherName,
  subjectStyle,
} from "@/lib/class-site";
import type { TimetableCell } from "@/lib/class-site";

/** Tiết đang mở bảng liên lạc: môn, tên thầy cô và số điện thoại. */
type ContactTarget = { subject: string; teacher: string; phone: string; day: string; period: number };

function ContactSheet({ target, onClose }: { target: ContactTarget; onClose: () => void }) {
  return (
    <div className="tkb-call" onClick={onClose} role="presentation">
      <div className="tkb-call-card" onClick={(event) => event.stopPropagation()} role="dialog">
        <p className="tkb-call-when">
          Thứ {target.day} · tiết {target.period}
        </p>
        <h3>{target.subject}</h3>
        <p className="tkb-call-teacher">{target.teacher}</p>
        <p className="tkb-call-phone">{target.phone}</p>
        <div className="tkb-call-actions">
          <a className="button-primary" href={`tel:${target.phone}`}>
            📞 Gọi
          </a>
          <a
            className="button-secondary"
            href={`https://zalo.me/${target.phone}`}
            rel="noreferrer"
            target="_blank"
          >
            💬 Zalo
          </a>
        </div>
        <button className="tkb-call-close" onClick={onClose} type="button">
          Đóng
        </button>
      </div>
    </div>
  );
}

function TimetableTable({
  title,
  badge,
  periods,
  rows,
  todayIndex,
  onPick,
}: {
  title: string;
  badge: string;
  periods: number[];
  rows: Record<number, TimetableCell[]>;
  /** 0 = thứ Hai … 5 = thứ Bảy; null khi chưa biết (lúc render trên server). */
  todayIndex: number | null;
  onPick: (target: ContactTarget) => void;
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
                // Chỉ tiết nào có số điện thoại mới bấm được, tránh ô bấm vào
                // rồi không ra gì.
                const callable = !empty && Boolean(cell.phone && teacher);
                return (
                  <td
                    className={[
                      empty ? "subject-empty" : cell.className || style.className,
                      index === todayIndex ? "is-today-col" : "",
                      callable ? "is-callable" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={`${period}-${index}`}
                    onClick={
                      callable
                        ? () =>
                            onPick({
                              subject: cell.subject,
                              teacher: teacher ?? "",
                              phone: cell.phone ?? "",
                              day: DAY_LABELS[index] ?? "",
                              period,
                            })
                        : undefined
                    }
                    rowSpan={cell.rowspan}
                    title={callable ? `Bấm để gọi hoặc Zalo ${teacher}` : undefined}
                  >
                    {empty ? "–" : cell.subject}
                    {!empty && teacher ? (
                      <span className="tkb-teacher" title={teacher}>
                        {shortTeacherName(teacher)}
                        {callable ? <i aria-hidden="true">📞</i> : null}
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
  const [target, setTarget] = useState<ContactTarget | null>(null);

  return (
    <>
      <TimetableTable
        badge="Tiết 1–5"
        onPick={setTarget}
        periods={[1, 2, 3, 4, 5]}
        rows={morning}
        title={CLASS_SITE.morningTitle}
        todayIndex={todayIndex}
      />
      <TimetableTable
        badge="Tiết 2–5"
        onPick={setTarget}
        periods={[2, 3, 4, 5]}
        rows={afternoon}
        title={CLASS_SITE.afternoonTitle}
        todayIndex={todayIndex}
      />
      {target ? <ContactSheet onClose={() => setTarget(null)} target={target} /> : null}
    </>
  );
}
