import type { Student } from "@/lib/types";

/**
 * Sơ đồ chỗ ngồi — mô hình dùng chung giữa web và sheet "SoDoLop".
 *
 * Phòng học có 4 tổ, mỗi tổ một dãy bàn đôi. Nhìn từ bảng xuống, hai lối đi
 * chia phòng thành ba khối:  [Tổ 4] · lối đi · [Tổ 3][Tổ 2] · lối đi · [Tổ 1].
 * "Chỗ phía ngoài" là chỗ sát lối đi (ra vào dễ), "chỗ phía trong" là chỗ còn
 * lại. Bàn 1 là bàn đầu, gần bàn giáo viên nhất.
 */
export const SEAT_TEAMS = [1, 2, 3, 4] as const;
export const SEAT_SIDES = ["trong", "ngoai"] as const;
export type SeatSide = (typeof SEAT_SIDES)[number];

export const SEAT_SIDE_LABELS: Record<SeatSide, string> = {
  trong: "Chỗ phía trong",
  ngoai: "Chỗ phía ngoài",
};

export const DEFAULT_DESK_COUNT = 6;
export const MIN_DESK_COUNT = 2;
export const MAX_DESK_COUNT = 8;

/**
 * Cột Excel của từng chỗ trong sheet "SoDoLop" (A=1).
 *
 * Tổ 4 nằm sát tường trái nên chỗ trong là cột B; tổ 1 sát tường phải nên chỗ
 * trong là cột K. Hai tổ giữa quay lưng nhau, lối đi ở cột D và cột I.
 * Đổi bố trí phòng thì chỉ cần sửa bảng này.
 */
export const SEAT_COLUMNS: Record<number, Record<SeatSide, number>> = {
  1: { ngoai: 10, trong: 11 }, // J, K
  2: { trong: 7, ngoai: 8 }, //  G, H
  3: { ngoai: 5, trong: 6 }, //  E, F
  4: { trong: 2, ngoai: 3 }, //  B, C
};

export type Seat = { team: number; desk: number; side: SeatSide };

export function isValidDeskCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_DESK_COUNT &&
    value <= MAX_DESK_COUNT
  );
}

export function normalizeDeskCount(value: unknown) {
  const parsed = Number(value);
  if (!isValidDeskCount(parsed)) return DEFAULT_DESK_COUNT;
  return parsed;
}

export function seatKey(seat: Seat) {
  return `${seat.team}-${seat.desk}-${seat.side}`;
}

export function seatLabel(seat: Seat) {
  return `Tổ ${seat.team} - Bàn ${seat.desk} - ${SEAT_SIDE_LABELS[seat.side].toLowerCase()}`;
}

/** Chỗ ngồi của học sinh, hoặc null khi chưa xếp. */
export function studentSeat(
  student: Pick<Student, "teamNumber" | "seatDesk" | "seatSide">,
): Seat | null {
  const team = Number(student.teamNumber);
  const desk = Number(student.seatDesk);
  const side = student.seatSide;
  if (!SEAT_TEAMS.includes(team as (typeof SEAT_TEAMS)[number])) return null;
  if (!Number.isInteger(desk) || desk < 1) return null;
  if (side !== "trong" && side !== "ngoai") return null;
  return { team, desk, side };
}

/** Dòng Excel của bàn thứ `desk`: bàn 1 ở dòng 7, mỗi bàn cách nhau một dòng trống. */
export function seatRow(desk: number) {
  return 7 + (desk - 1) * 2;
}

export function seatColumn(team: number, side: SeatSide) {
  return SEAT_COLUMNS[team]?.[side] ?? 0;
}

/** Dòng ghi nhãn "Tổ 4 … Tổ 1", ngay dưới bàn cuối cùng. */
export function seatFooterRow(deskCount: number) {
  return seatRow(deskCount) + 1;
}

/**
 * Ai đang giữ chỗ đó — dùng để chặn xếp hai em vào cùng một chỗ.
 * Bỏ qua chính học sinh đang được xếp lại.
 */
export function findSeatHolder<T extends { _id?: string; fullName: string }>(
  students: Array<T & Pick<Student, "teamNumber" | "seatDesk" | "seatSide">>,
  seat: Seat,
  exceptId?: string,
) {
  const key = seatKey(seat);
  return (
    students.find((student) => {
      if (exceptId && String(student._id) === exceptId) return false;
      const current = studentSeat(student);
      return current ? seatKey(current) === key : false;
    }) ?? null
  );
}
