/**
 * Điểm danh theo dịp: lao động tập trung, khai giảng, 20/11, tổng kết năm…
 *
 * Mỗi dịp là một bản ghi riêng, GVCN tự thêm bao nhiêu dịp cũng được. Số buổi
 * vắng không phép cộng dồn cả năm chính là căn cứ hạ hạnh kiểm, nên chỗ này
 * không chỉ đánh dấu cho vui — nó phải cộng ra được một con số.
 */

export type AttendanceMark = "present" | "absent";

export type AttendanceEvent = {
  _id: string;
  schoolYearId: string;
  name: string;
  /** yyyy-mm-dd */
  date: string;
  note: string;
  /** Mỗi buổi vắng không phép trừ mấy điểm — dịp quan trọng thì đặt cao hơn. */
  penalty: number;
  /** Chốt rồi thì khoá, không sửa được nữa trừ khi mở lại. */
  closed: boolean;
  /** studentId → có mặt / vắng. Không có tên trong đây là chưa điểm danh. */
  marks: Record<string, AttendanceMark>;
  /** Những em vắng nhưng có phép — vẫn tính là vắng, chỉ không trừ điểm. */
  excused: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
};

/** Gợi ý bấm một cái là thêm, khỏi gõ lại mấy dịp năm nào cũng có. */
export const SUGGESTED_EVENTS = [
  "Lao động tập trung",
  "Khai giảng",
  "Chào cờ đầu tuần",
  "20/11 — Ngày Nhà giáo",
  "Hội thao",
  "Văn nghệ",
  "Tổng kết học kỳ 1",
  "Tổng kết năm học",
] as const;

export const DEFAULT_PENALTY = 1;

export function sanitizeName(raw: unknown) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Chỉ nhận yyyy-mm-dd và phải là ngày có thật. */
export function sanitizeDate(raw: unknown) {
  const text = String(raw ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  const real =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  return real ? text : "";
}

export function sanitizePenalty(raw: unknown) {
  const value = Math.round(Number(raw));
  if (!Number.isFinite(value)) return DEFAULT_PENALTY;
  return Math.min(Math.max(value, 0), 10);
}

/**
 * Lọc bảng điểm danh gửi lên: chỉ giữ học sinh có thật trong sổ, chỉ nhận hai
 * trạng thái. "Có phép" chỉ có nghĩa với em đang bị đánh vắng.
 */
export function sanitizeMarks(raw: unknown, validIds: Set<string>) {
  const marks: Record<string, AttendanceMark> = {};
  if (raw && typeof raw === "object") {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!validIds.has(id)) continue;
      if (value === "present" || value === "absent") marks[id] = value;
    }
  }
  return marks;
}

export function sanitizeExcused(raw: unknown, marks: Record<string, AttendanceMark>) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(String))].filter((id) => marks[id] === "absent");
}

export type StudentAbsence = {
  studentId: string;
  absent: number;
  excused: number;
  unexcused: number;
  penalty: number;
};

/**
 * Cộng dồn cả năm cho từng em. Chỉ đếm những dịp đã điểm danh em đó — dịp mới
 * tạo mà chưa mở ra đánh thì không tính là vắng.
 */
export function summariseAbsences(events: AttendanceEvent[]): Map<string, StudentAbsence> {
  const summary = new Map<string, StudentAbsence>();
  for (const event of events) {
    const excused = new Set(event.excused ?? []);
    for (const [studentId, mark] of Object.entries(event.marks ?? {})) {
      if (mark !== "absent") continue;
      const row =
        summary.get(studentId) ??
        { studentId, absent: 0, excused: 0, unexcused: 0, penalty: 0 };
      row.absent += 1;
      if (excused.has(studentId)) {
        row.excused += 1;
      } else {
        row.unexcused += 1;
        row.penalty += event.penalty ?? DEFAULT_PENALTY;
      }
      summary.set(studentId, row);
    }
  }
  return summary;
}

/** Đếm nhanh cho thẻ dịp: đã đánh bao nhiêu, vắng bao nhiêu. */
export function countEvent(event: Pick<AttendanceEvent, "marks" | "excused">) {
  let present = 0;
  let absent = 0;
  for (const mark of Object.values(event.marks ?? {})) {
    if (mark === "present") present += 1;
    else if (mark === "absent") absent += 1;
  }
  return { present, absent, marked: present + absent, excused: (event.excused ?? []).length };
}

/** dd/mm/yyyy cho người đọc; dữ liệu vẫn giữ yyyy-mm-dd. */
export function formatEventDate(iso: string) {
  const match = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso || "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}
