"use client";

import { useMemo } from "react";

import { DAY_LABELS, canonicalSubject, subjectAliasTable } from "@/lib/class-site";
import type { TimetableGrid } from "@/lib/excel-timetable";

const MORNING_PERIODS = [1, 2, 3, 4, 5];
const AFTERNOON_PERIODS = [2, 3, 4, 5];

/**
 * Gõ thẳng thời khóa biểu trên web, không cần vòng qua Excel.
 *
 * Ô nhập có gợi ý sẵn tên môn và mọi cách viết tắt web hiểu, nên gõ "t" rồi
 * Tab là xong một tiết. Bảng giáo viên bên dưới liệt kê đủ môn, kể cả môn chưa
 * xếp tiết, để điền trước tên và số điện thoại thầy cô.
 */
export function TimetableGridEditor({
  grid,
  readOnly,
  onChange,
}: {
  grid: TimetableGrid;
  readOnly: boolean;
  onChange: (next: TimetableGrid) => void;
}) {
  const suggestions = useMemo(() => {
    const list: string[] = [];
    for (const [subject, aliases] of subjectAliasTable()) {
      list.push(subject, ...aliases.map((alias) => alias.toLowerCase()));
    }
    return [...new Set(list)];
  }, []);

  /**
   * Toàn bộ môn cần hỏi giáo viên: mọi môn app biết, cộng môn lớp tự thêm vào
   * lưới hoặc đã có tên thầy cô. Chỉ liệt kê môn đang xếp tiết thì lớp mới nhập
   * vài tiết là bảng trống trơn, không điền trước được.
   */
  const allSubjects = useMemo(() => {
    const set = new Set<string>(subjectAliasTable().keys());
    for (const session of [grid.morning, grid.afternoon]) {
      for (const cells of Object.values(session ?? {})) {
        for (const cell of cells ?? []) {
          const name = canonicalSubject(String(cell ?? ""));
          if (name && name !== "-") set.add(name);
        }
      }
    }
    for (const key of Object.keys(grid.teachers ?? {})) set.add(key);
    for (const key of Object.keys(grid.teacherPhones ?? {})) set.add(key);
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [grid]);

  /** Môn đang thật sự có tiết — đánh dấu để biết môn nào cần điền trước. */
  const scheduled = useMemo(() => {
    const set = new Set<string>();
    for (const session of [grid.morning, grid.afternoon]) {
      for (const cells of Object.values(session ?? {})) {
        for (const cell of cells ?? []) {
          const name = canonicalSubject(String(cell ?? ""));
          if (name && name !== "-") set.add(name);
        }
      }
    }
    return set;
  }, [grid]);

  function setCell(session: "morning" | "afternoon", period: number, day: number, value: string) {
    const cells = [...((grid[session] ?? {})[period] ?? DAY_LABELS.map(() => ""))];
    cells[day] = value;
    onChange({ ...grid, [session]: { ...grid[session], [period]: cells } });
  }

  function setTeacher(subject: string, key: "teachers" | "teacherPhones", value: string) {
    onChange({ ...grid, [key]: { ...(grid[key] ?? {}), [subject]: value } });
  }

  /** Chép nguyên một ngày sang ngày khác — lịch nhiều lớp lặp gần như y hệt. */
  function copyDay(from: number, to: number) {
    if (from === to) return;
    const next = { ...grid };
    for (const session of ["morning", "afternoon"] as const) {
      const periods = session === "morning" ? MORNING_PERIODS : AFTERNOON_PERIODS;
      const rows: Record<number, string[]> = { ...(grid[session] ?? {}) };
      for (const period of periods) {
        const cells = [...(rows[period] ?? DAY_LABELS.map(() => ""))];
        cells[to] = cells[from] ?? "";
        rows[period] = cells;
      }
      next[session] = rows;
    }
    onChange(next);
  }

  function renderSession(session: "morning" | "afternoon", title: string, periods: number[]) {
    return (
      <div className="tkb-edit-block" key={session}>
        <h4>{title}</h4>
        <div className="tkb-edit-scroll">
          <table className="tkb-edit-table">
            <thead>
              <tr>
                <th scope="col">Tiết</th>
                {DAY_LABELS.map((day) => (
                  <th key={day} scope="col">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period}>
                  <th scope="row">{period}</th>
                  {DAY_LABELS.map((day, index) => (
                    <td key={day}>
                      <input
                        aria-label={`Thứ ${day}, tiết ${period}`}
                        autoComplete="off"
                        disabled={readOnly}
                        list="tkb-subjects"
                        onChange={(event) => setCell(session, period, index, event.target.value)}
                        placeholder="—"
                        value={(grid[session] ?? {})[period]?.[index] ?? ""}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="tkb-edit">
      <datalist id="tkb-subjects">
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <p className="text-sm leading-6 text-slate-600">
        Gõ tên môn hoặc viết tắt (<code>t</code> → Toán, <code>v</code> → Văn…), ô trống hoặc <code>-</code> là
        không có tiết. Ô nhập có gợi ý sẵn, gõ một chữ rồi nhấn Tab là sang ô kế.
      </p>

      <div className="tkb-edit-copy">
        <span>Chép cả ngày:</span>
        {DAY_LABELS.map((day, index) => (
          <select
            disabled={readOnly}
            key={day}
            onChange={(event) => {
              const to = Number(event.target.value);
              if (Number.isInteger(to)) copyDay(index, to);
              event.target.value = "";
            }}
            value=""
          >
            <option value="">{day} →</option>
            {DAY_LABELS.map((target, targetIndex) =>
              targetIndex === index ? null : (
                <option key={target} value={targetIndex}>
                  chép sang {target}
                </option>
              ),
            )}
          </select>
        ))}
      </div>

      {renderSession("morning", "Buổi sáng · tiết 1–5", MORNING_PERIODS)}
      {renderSession("afternoon", "Trái buổi chiều · tiết 2–5", AFTERNOON_PERIODS)}

      <div className="tkb-edit-block">
        <h4>Giáo viên bộ môn</h4>
        <p className="mb-2 text-sm leading-6 text-slate-600">
          Điền tên và số điện thoại để trang chủ hiện tên thầy cô và bấm vào ô là gọi hoặc Zalo được. Môn nào lớp
          chưa xếp tiết vẫn điền trước được; môn lạ chỉ cần gõ vào bảng trên là tự hiện thêm dòng ở đây.
        </p>
        <div className="tkb-edit-teachers">
          <span className="tkb-edit-head">Môn</span>
          <span className="tkb-edit-head">Giáo viên dạy</span>
          <span className="tkb-edit-head">SĐT (gọi &amp; Zalo)</span>
          {allSubjects.map((subject) => (
            <FragmentRow
              key={subject}
              onPhone={(value) => setTeacher(subject, "teacherPhones", value)}
              onTeacher={(value) => setTeacher(subject, "teachers", value)}
              phone={grid.teacherPhones?.[subject] ?? ""}
              readOnly={readOnly}
              scheduled={scheduled.has(subject)}
              subject={subject}
              teacher={grid.teachers?.[subject] ?? ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  subject,
  teacher,
  phone,
  readOnly,
  scheduled,
  onTeacher,
  onPhone,
}: {
  subject: string;
  teacher: string;
  phone: string;
  readOnly: boolean;
  scheduled: boolean;
  onTeacher: (value: string) => void;
  onPhone: (value: string) => void;
}) {
  return (
    <>
      <span className={`tkb-edit-subject${scheduled ? " is-scheduled" : ""}`}>
        {subject}
        {scheduled ? <em title="Lớp đang có tiết môn này">•</em> : null}
      </span>
      <input
        aria-label={`Giáo viên dạy ${subject}`}
        autoComplete="off"
        disabled={readOnly}
        onChange={(event) => onTeacher(event.target.value)}
        placeholder="Họ tên thầy cô"
        value={teacher}
      />
      <input
        aria-label={`Số điện thoại giáo viên dạy ${subject}`}
        autoComplete="off"
        disabled={readOnly}
        inputMode="tel"
        onChange={(event) => onPhone(event.target.value)}
        placeholder="09xxxxxxxx"
        value={phone}
      />
    </>
  );
}
