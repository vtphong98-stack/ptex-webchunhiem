"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_DESK_COUNT,
  MAX_DESK_COUNT,
  MIN_DESK_COUNT,
  SEAT_SIDE_LABELS,
  seatKey,
  seatLabel,
  type Seat,
  type SeatSide,
} from "@/lib/syll-seats";
import { CLASS_DUTY_LABELS, TEAM_ROLE_LABELS, classDutyOptions, dutyTags } from "@/lib/team-roster";
import { TEAM_ROLES, type ClassDuty, type TeamRole } from "@/lib/types";

type SyllStudentRow = {
  _id: string;
  tt: number | null;
  fullName: string;
  teamNumber: number | null;
  seatDesk: number | null;
  seatSide: SeatSide | null;
  teamRole: TeamRole | null;
  classDuty: ClassDuty | null;
  /** Viết tắt chức vụ, đúng chuỗi in ra sơ đồ Excel: ["LPLĐ", "TT2"]. */
  dutyTags: string[];
  position: string;
  submittedAt: string;
  contactPhone: string;
};

type SyllData = {
  yearName: string;
  isCurrent: boolean;
  deskCount: number;
  schoolName: string;
  className: string;
  gvcnName: string;
  students: SyllStudentRow[];
};

/**
 * Thứ tự cột đúng như sheet SoDoLop nhìn từ bảng xuống: tổ 4 sát tường trái,
 * hai tổ giữa quay lưng nhau, tổ 1 sát tường phải. Xếp trên web thấy sao thì in
 * ra Excel y vậy.
 */
const ROOM_COLUMNS: Array<{ team: number; side: SeatSide } | "aisle"> = [
  { team: 4, side: "trong" },
  { team: 4, side: "ngoai" },
  "aisle",
  { team: 3, side: "ngoai" },
  { team: 3, side: "trong" },
  { team: 2, side: "trong" },
  { team: 2, side: "ngoai" },
  "aisle",
  { team: 1, side: "ngoai" },
  { team: 1, side: "trong" },
];

type DutyPatch = {
  _id: string;
  teamNumber: number | null;
  teamRole: TeamRole | null;
  classDuty: ClassDuty | null;
  seatDesk: number | null;
  seatSide: SeatSide | null;
  position: string;
};

function dutyMessage(
  payload: { notice?: string; student: DutyPatch },
  seat: Seat | null,
  duty?: { classDuty?: ClassDuty | null; teamRole?: TeamRole },
) {
  if (payload.notice) return payload.notice;
  if (duty?.classDuty !== undefined) {
    return duty.classDuty
      ? `Đã giao chức ${CLASS_DUTY_LABELS[duty.classDuty].toLowerCase()} — tài khoản đăng nhập của chức vụ này giờ mang tên em đó.`
      : "Đã cho thôi chức vụ lớp.";
  }
  if (duty?.teamRole !== undefined) {
    return `Đã đặt làm ${TEAM_ROLE_LABELS[duty.teamRole].toLowerCase()}.`;
  }
  return seat ? `Đã xếp vào ${seatLabel(seat)}.` : "Đã bỏ chỗ ngồi.";
}

function RemoveButton({ onRemove, readOnly }: { onRemove: () => void; readOnly: boolean }) {
  if (readOnly) return null;
  return (
    <button
      aria-label="Xóa học sinh khỏi dữ liệu lớp"
      className="text-xs font-semibold text-red-600 hover:underline"
      onClick={onRemove}
      title="Xóa khỏi dữ liệu lớp"
      type="button"
    >
      Xóa
    </button>
  );
}

function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length <= 2 ? fullName : parts.slice(-2).join(" ");
}

function seatOf(student: SyllStudentRow): Seat | null {
  if (!student.teamNumber || !student.seatDesk || !student.seatSide) return null;
  return { team: student.teamNumber, desk: student.seatDesk, side: student.seatSide };
}

function formatDate(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function SyllManager({ yearName = "" }: { yearName?: string }) {
  const [data, setData] = useState<SyllData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openSeat, setOpenSeat] = useState("");
  const [blankRows, setBlankRows] = useState(50);
  const [tab, setTab] = useState<"progress" | "seats">("progress");
  /** Em có trong web nhưng không còn trong file GVCN vừa nhập. */
  const [stale, setStale] = useState<Array<{ _id: string; fullName: string }>>([]);

  const qs = yearName ? `?year=${encodeURIComponent(yearName)}` : "";
  const templateHref = `/api/gvcn/syll/template?${new URLSearchParams({
    ...(yearName ? { year: yearName } : {}),
    rows: String(blankRows),
  })}`;
  const readOnly = Boolean(data && !data.isCurrent);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/gvcn/syll${qs}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Chưa tải được sơ yếu lý lịch.");
        return;
      }
      setData(payload as SyllData);
      setError("");
    } catch {
      setError("Chưa tải được sơ yếu lý lịch.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const students = useMemo(() => data?.students ?? [], [data]);
  const deskCount = data?.deskCount ?? DEFAULT_DESK_COUNT;

  const bySeat = useMemo(() => {
    const map = new Map<string, SyllStudentRow>();
    for (const student of students) {
      const seat = seatOf(student);
      if (seat) map.set(seatKey(seat), student);
    }
    return map;
  }, [students]);

  const filled = students.filter((student) => student.submittedAt);
  const missing = students.filter((student) => !student.submittedAt);
  const unseated = students.filter((student) => !seatOf(student));

  async function patchSeat(
    studentId: string,
    seat: Seat | null,
    duty?: { classDuty?: ClassDuty | null; teamRole?: TeamRole },
  ) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/gvcn/syll/seats${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          teamNumber: seat?.team ?? null,
          seatDesk: seat?.desk ?? null,
          seatSide: seat?.side ?? null,
          ...duty,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Giữ bảng chọn mở để GVCN chọn lại ngay, khỏi phải bấm vào ô lần nữa.
        setError(payload.error || "Không lưu được chỗ ngồi.");
        return;
      }
      // payload.peers là những em bị hạ chức vì trùng chức vụ — phải vẽ lại luôn,
      // nếu không sơ đồ vẫn hiện hai tổ trưởng cùng một tổ cho tới lần tải sau.
      const changed = new Map<string, DutyPatch>(
        [payload.student, ...(payload.peers ?? [])].map((item: DutyPatch) => [item._id, item]),
      );
      setData((current) =>
        current
          ? {
              ...current,
              students: current.students.map((student) => {
                const patch = changed.get(student._id);
                return patch ? { ...student, ...patch, dutyTags: dutyTags(patch) } : student;
              }),
            }
          : current,
      );
      setMessage(dutyMessage(payload, seat, duty));
      // Đổi chức vụ thì giữ bảng chọn mở để GVCN giao tiếp chức khác cho cùng em.
      if (!duty) setOpenSeat("");
    } finally {
      setBusy(false);
    }
  }

  /** Bổ nhiệm chức vụ cho em đang ngồi ở chỗ đang mở — cùng một API với xếp chỗ. */
  async function patchDuty(studentId: string, duty: { classDuty?: ClassDuty | null; teamRole?: TeamRole }) {
    const student = students.find((item) => item._id === studentId);
    await patchSeat(studentId, student ? seatOf(student) : null, duty);
  }

  /**
   * Xoá hẳn học sinh khỏi dữ liệu lớp: hồ sơ, liên hệ phụ huynh, chỗ ngồi và
   * chức vụ. Không hoàn tác được nên hỏi lại bằng đúng tên em đó.
   */
  async function removeStudents(targets: Array<{ _id: string; fullName: string }>) {
    if (!targets.length) return;
    const names = targets.map((item) => item.fullName);
    const shown = names.slice(0, 10).join("\n");
    const question =
      targets.length === 1
        ? `Xóa ${names[0]} khỏi dữ liệu lớp?\n\nMất luôn sơ yếu lý lịch, chỗ ngồi và liên hệ phụ huynh của em. Không hoàn tác được.`
        : `Xóa ${targets.length} em khỏi dữ liệu lớp?\n\n${shown}${
            names.length > 10 ? `\n… và ${names.length - 10} em nữa` : ""
          }\n\nMất luôn sơ yếu lý lịch, chỗ ngồi và liên hệ phụ huynh của các em. Không hoàn tác được.`;
    if (!window.confirm(question)) return;

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const failed: string[] = [];
      for (const target of targets) {
        const response = await fetch(`/api/gvcn/students/${target._id}`, { method: "DELETE" });
        if (!response.ok) failed.push(target.fullName);
      }
      setStale((current) => current.filter((item) => targets.every((target) => target._id !== item._id)));
      if (failed.length) setError(`Không xóa được: ${failed.join(", ")}.`);
      else setMessage(targets.length === 1 ? `Đã xóa ${names[0]}.` : `Đã xóa ${targets.length} em.`);
      setLoading(true);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function changeDeskCount(next: number) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/gvcn/syll${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deskCount: next }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Không đổi được số bàn.");
        return;
      }
      setData((current) => (current ? { ...current, deskCount: next } : current));
      setMessage(`Mỗi tổ còn ${next} bàn.`);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/gvcn/syll/import${qs}`, { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Nhập danh sách thất bại.");
        return;
      }
      // Em nào không còn trong file thì liệt kê riêng bên dưới kèm nút xoá,
      // chứ nhồi hết vào một dòng thông báo thì đọc không nổi mà cũng không
      // làm gì được.
      setStale(payload.missing ?? []);
      setMessage(
        `Đã nhận ${payload.total} em: thêm ${payload.created}, cập nhật ${payload.updated}.` +
          (payload.missing?.length ? ` Còn ${payload.missing.length} em không có trong file — xem bên dưới.` : ""),
      );
      setLoading(true);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function seatCell(team: number, side: SeatSide, desk: number) {
    const seat: Seat = { team, desk, side };
    const key = seatKey(seat);
    const holder = bySeat.get(key);

    return (
      <button
        className={[
          "seat",
          holder ? "seat-taken" : "",
          holder && !holder.submittedAt ? "seat-missing" : "",
          openSeat === key ? "seat-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={readOnly || busy}
        key={key}
        onClick={() => setOpenSeat(openSeat === key ? "" : key)}
        title={`${seatLabel(seat)}${holder ? ` — ${holder.fullName}` : " — còn trống"}`}
        type="button"
      >
        {holder ? (
          <>
            <span className="seat-name">{shortName(holder.fullName)}</span>
            {holder.dutyTags.length ? <span className="seat-role">{holder.dutyTags.join(" · ")}</span> : null}
          </>
        ) : (
          <span className="seat-empty">Trống</span>
        )}
      </button>
    );
  }

  /**
   * Bảng chọn nằm dưới sơ đồ chứ không nhét vào trong ô: ô chỉ rộng ~90px, thả
   * hộp chọn vào đó thì trên điện thoại không đọc nổi tên ai. Chức vụ bổ nhiệm
   * ngay tại đây cho liền một mạch việc — xếp chỗ xong là giao chức luôn.
   */
  function seatPicker() {
    if (!openSeat) return null;
    const [team, desk, side] = openSeat.split("-");
    const seat: Seat = { team: Number(team), desk: Number(desk), side: side as SeatSide };
    const holder = bySeat.get(openSeat);

    return (
      <div className="seat-picker">
        <div className="seat-picker-head">
          <p className="seat-picker-title">{seatLabel(seat)}</p>
          <p className="seat-picker-now">{holder ? `Đang ngồi: ${holder.fullName}` : "Chỗ này còn trống"}</p>
        </div>

        <label className="seat-picker-field">
          <span>Học sinh</span>
          <select
            autoFocus
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "") {
                if (holder) void patchSeat(holder._id, null);
                else setOpenSeat("");
                return;
              }
              void patchSeat(value, seat);
            }}
            value={holder?._id ?? ""}
          >
            <option value="">— Để trống —</option>
            {students.map((student) => {
              const current = seatOf(student);
              return (
                <option key={student._id} value={student._id}>
                  {student.tt ? `${student.tt}. ` : ""}
                  {student.fullName}
                  {current && student._id !== holder?._id ? ` (đang ở ${seatLabel(current)})` : ""}
                </option>
              );
            })}
          </select>
        </label>

        {holder ? (
          <>
            <label className="seat-picker-field">
              <span>Chức vụ lớp</span>
              <select
                disabled={busy}
                onChange={(event) =>
                  void patchDuty(holder._id, { classDuty: (event.target.value || null) as ClassDuty | null })
                }
                value={holder.classDuty ?? ""}
              >
                <option value="">— Không giữ chức —</option>
                {classDutyOptions().map((duty) => (
                  <option key={duty.value} value={duty.value}>
                    {duty.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="seat-picker-field">
              <span>Chức vụ tổ {seat.team}</span>
              <select
                disabled={busy}
                onChange={(event) => void patchDuty(holder._id, { teamRole: event.target.value as TeamRole })}
                value={holder.teamRole ?? "thanhVien"}
              >
                {TEAM_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {TEAM_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <button className="button-secondary" onClick={() => setOpenSeat("")} type="button">
          Đóng
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-semibold">Sơ yếu lý lịch &amp; sơ đồ chỗ ngồi</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Quy trình ba bước: <b>tải mẫu rỗng</b> → gõ số thứ tự + họ tên rồi <b>tải lên</b> → học sinh vào trang{" "}
          <code>/syll</code> tự khai. Xong thì xuất file Excel đúng biểu mẫu nhà trường, có sẵn cả sơ đồ chỗ ngồi.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Số dòng mẫu</span>
            <input
              className="w-24 rounded-xl border-2 border-slate-200 px-3 py-2"
              max={60}
              min={1}
              onChange={(event) => setBlankRows(Number(event.target.value) || 50)}
              type="number"
              value={blankRows}
            />
          </label>
          <a className="button-secondary" href={templateHref}>
            Tải mẫu rỗng
          </a>
          <label className={`button-primary ${readOnly ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
            {busy ? "Đang xử lý…" : "Tải danh sách lên"}
            <input
              accept=".xlsx"
              className="hidden"
              disabled={busy || readOnly}
              onChange={(event) => {
                void importFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <a className="button-secondary" href={`/api/gvcn/syll/export${qs}`}>
            Xuất Excel đầy đủ
          </a>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Số bàn mỗi tổ</span>
            <select
              disabled={readOnly || busy}
              onChange={(event) => void changeDeskCount(Number(event.target.value))}
              value={deskCount}
            >
              {Array.from({ length: MAX_DESK_COUNT - MIN_DESK_COUNT + 1 }, (_, i) => MIN_DESK_COUNT + i).map((n) => (
                <option key={n} value={n}>
                  {n} bàn ({n * 8} chỗ)
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500">
            4 tổ × {deskCount} bàn × 2 chỗ = <b>{deskCount * 8} chỗ</b> cho {students.length} em.
          </p>
        </div>

        {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
        {readOnly ? <p className="mt-3 text-sm text-amber-700">Năm cũ chỉ xem, không sửa được.</p> : null}
      </div>

      {stale.length ? (
        <div className="card border-2 border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">
            {stale.length} em có trong web nhưng không có trong file vừa nhập
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            Thường là em đã chuyển lớp, hoặc file thiếu dòng. Kiểm lại rồi xóa nếu đúng là các em không còn học ở
            lớp mình.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {stale.map((student) => (
              <li className="rounded-full bg-white px-3 py-1 text-sm" key={student._id}>
                {student.fullName}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="button-primary"
              disabled={readOnly || busy}
              onClick={() => void removeStudents(stale)}
              type="button"
            >
              Xóa {stale.length} em này
            </button>
            <button className="button-secondary" onClick={() => setStale([])} type="button">
              Giữ lại
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          className={tab === "progress" ? "button-primary" : "button-secondary"}
          onClick={() => setTab("progress")}
          type="button"
        >
          Tiến độ khai ({filled.length}/{students.length})
        </button>
        <button
          className={tab === "seats" ? "button-primary" : "button-secondary"}
          onClick={() => setTab("seats")}
          type="button"
        >
          Sơ đồ chỗ ngồi ({students.length - unseated.length}/{students.length})
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Đang tải…</p> : null}

      {tab === "progress" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <article className="card p-4">
            <h3 className="mb-3 font-semibold text-red-600">Chưa điền ({missing.length})</h3>
            {!missing.length ? (
              <p className="text-sm text-slate-500">Cả lớp đã khai xong.</p>
            ) : (
              <ol className="space-y-1 text-sm">
                {missing.map((student) => (
                  <li className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2" key={student._id}>
                    <span>
                      <b>{student.tt ?? "–"}.</b> {student.fullName}
                    </span>
                    <span className="flex items-center gap-3">
                      {student.contactPhone ? (
                        <a className="text-xs font-semibold text-red-700" href={`tel:${student.contactPhone}`}>
                          {student.contactPhone}
                        </a>
                      ) : null}
                      <RemoveButton onRemove={() => removeStudents([student])} readOnly={readOnly || busy} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <article className="card p-4">
            <h3 className="mb-3 font-semibold text-emerald-700">Đã điền ({filled.length})</h3>
            {!filled.length ? (
              <p className="text-sm text-slate-500">Chưa em nào khai.</p>
            ) : (
              <ol className="space-y-1 text-sm">
                {filled.map((student) => (
                  <li
                    className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2"
                    key={student._id}
                  >
                    <span>
                      <b>{student.tt ?? "–"}.</b> {student.fullName}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-emerald-700">{formatDate(student.submittedAt)}</span>
                      <RemoveButton onRemove={() => removeStudents([student])} readOnly={readOnly || busy} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </div>
      ) : (
        <div className="card p-4">
          <p className="mb-3 text-sm text-slate-600">
            Bấm vào một chỗ để xếp học sinh. Một chỗ chỉ nhận một em — chọn em đang ngồi nơi khác thì em đó chuyển
            sang đây. Viền đỏ là em <b>chưa khai</b> sơ yếu lý lịch.
          </p>

          <div className="seat-room">
            <div className="seat-teacher">Bàn giáo viên</div>

            <div className="seat-grid">
              {Array.from({ length: deskCount }, (_, index) => index + 1).map((desk) => (
                <div className="seat-row" key={desk}>
                  <span className="seat-desk-no">Bàn {desk}</span>
                  {ROOM_COLUMNS.map((column, columnIndex) =>
                    column === "aisle" ? (
                      <span className="seat-aisle" key={`aisle-${columnIndex}`} />
                    ) : (
                      seatCell(column.team, column.side, desk)
                    ),
                  )}
                </div>
              ))}

              <div className="seat-row seat-legend-row">
                <span className="seat-desk-no" />
                {ROOM_COLUMNS.map((column, columnIndex) =>
                  column === "aisle" ? (
                    <span className="seat-aisle" key={`foot-${columnIndex}`} />
                  ) : (
                    <span className="seat-foot" key={`foot-${column.team}-${column.side}`}>
                      Tổ {column.team}
                      <em>{SEAT_SIDE_LABELS[column.side].replace("Chỗ phía ", "")}</em>
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>

          {seatPicker()}

          {unseated.length ? (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Chưa có chỗ ngồi ({unseated.length})</h3>
              <ul className="flex flex-wrap gap-2">
                {unseated.map((student) => (
                  <li className="rounded-full bg-slate-100 px-3 py-1 text-sm" key={student._id}>
                    {student.tt ? `${student.tt}. ` : ""}
                    {student.fullName}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-emerald-700">Cả lớp đã có chỗ ngồi.</p>
          )}
        </div>
      )}
    </section>
  );
}
