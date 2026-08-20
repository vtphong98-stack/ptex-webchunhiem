import { DAY_LABELS, shortTeacherName, subjectStyle, type TimetableCell } from "@/lib/class-site";

export type TimetableSession = {
  title: string;
  periods: number[];
  rows: Record<number, TimetableCell[]>;
};

/** Màu lấy từ CSS thật nên ảnh luôn khớp với những gì đang thấy trên trang. */
type Palette = Record<string, { bg: string; ink: string }>;

const SCALE = 3; // 3x để in ra vẫn nét
const PAD = 26;
const COL_PERIOD = 46;
const COL_DAY = 112;
const ROW_H = 60;
const HEAD_H = 36;
const SESSION_H = 34;
const TITLE_H = 78;
const FOOT_H = 34;
const GAP = 22;
const RADIUS = 8;
const FONT = '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif';

const INK = "#0f172a";
const INK_2 = "#3d4756";
const INK_3 = "#667287";
const HEAD_BG = "#eef1f7";
const PERIOD_BG = "#e7ebf3";
const EMPTY_BG = "#fafbfe";
const EMPTY_INK = "#c3cad8";
const CARD = "#ffffff";

/**
 * Đọc màu của từng lớp .subject-* từ bảng đang render.
 *
 * Bảng màu môn học nằm trong CSS; thay vì nhân bản nó sang JS (rồi hai bên lệch
 * nhau về sau) ta hỏi trực tiếp trình duyệt màu thật của một ô mỗi loại.
 */
export function readSubjectPalette(root: HTMLElement | null): Palette {
  const palette: Palette = {};
  if (!root) return palette;
  for (const cell of Array.from(root.querySelectorAll<HTMLTableCellElement>("td[class]"))) {
    const key = cell.className.split(/\s+/).find((name) => name.startsWith("subject-"));
    if (!key || palette[key]) continue;
    const style = window.getComputedStyle(cell);
    palette[key] = { bg: style.backgroundColor, ink: style.color };
  }
  return palette;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawSession(
  ctx: CanvasRenderingContext2D,
  session: TimetableSession,
  palette: Palette,
  top: number,
  left: number,
) {
  ctx.textBaseline = "middle";

  ctx.fillStyle = INK_2;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(session.title, left, top + SESSION_H / 2);

  let y = top + SESSION_H;

  // hàng tiêu đề
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = "center";
  const headers = ["Tiết", ...DAY_LABELS];
  let x = left;
  headers.forEach((label, index) => {
    const w = index === 0 ? COL_PERIOD : COL_DAY;
    ctx.fillStyle = index === 0 ? PERIOD_BG : HEAD_BG;
    roundRect(ctx, x, y, w - 3, HEAD_H - 3, RADIUS);
    ctx.fill();
    ctx.fillStyle = INK_2;
    ctx.fillText(label, x + (w - 3) / 2, y + (HEAD_H - 3) / 2);
    x += w;
  });
  y += HEAD_H;

  // các hàng tiết — vẽ theo rowspan nên ô ghép trong ảnh giống trên trang
  session.periods.forEach((period, rowIndex) => {
    const cells = session.rows[period] ?? [];
    ctx.fillStyle = PERIOD_BG;
    roundRect(ctx, left, y, COL_PERIOD - 3, ROW_H - 3, RADIUS);
    ctx.fill();
    ctx.fillStyle = INK_3;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(String(period), left + (COL_PERIOD - 3) / 2, y + (ROW_H - 3) / 2);

    cells.forEach((cell, dayIndex) => {
      if (cell.skip) return;
      const cx = left + COL_PERIOD + dayIndex * COL_DAY;
      const span = Math.max(1, cell.rowspan ?? 1);
      const ch = span * ROW_H - 3;
      const empty = !cell.subject || cell.subject === "-";
      const style = subjectStyle(cell.subject);
      const key = (cell.className || style.className || "").split(/\s+/).find((n) => n.startsWith("subject-"));
      const tone = (key && palette[key]) || null;

      ctx.fillStyle = empty ? EMPTY_BG : tone?.bg || HEAD_BG;
      roundRect(ctx, cx, y, COL_DAY - 3, ch, RADIUS);
      ctx.fill();

      if (empty) {
        ctx.fillStyle = EMPTY_INK;
        ctx.font = `600 13px ${FONT}`;
        ctx.fillText("–", cx + (COL_DAY - 3) / 2, y + ch / 2);
        return;
      }

      const teacher = shortTeacherName(cell.teacher || style.teacher);
      const midX = cx + (COL_DAY - 3) / 2;
      ctx.fillStyle = tone?.ink || INK;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(cell.subject, midX, y + ch / 2 - (teacher ? 8 : 0));
      if (teacher) {
        ctx.font = `600 10px ${FONT}`;
        ctx.globalAlpha = 0.8;
        ctx.fillText(teacher, midX, y + ch / 2 + 9);
        ctx.globalAlpha = 1;
      }
    });

    y += ROW_H;
    void rowIndex;
  });

  return y;
}

function sessionHeight(session: TimetableSession) {
  return SESSION_H + HEAD_H + session.periods.length * ROW_H;
}

/**
 * Vẽ trọn thời khóa biểu ra một canvas 3x rồi trả về blob PNG.
 *
 * Vẽ thẳng bằng Canvas 2D thay vì rasterise DOM: không cần thêm thư viện, ảnh
 * nét ở mọi cỡ, và không phụ thuộc phần bảng đang nằm trong hay ngoài màn hình.
 */
export async function renderTimetablePng(input: {
  sessions: TimetableSession[];
  palette: Palette;
  className: string;
  schoolYear: string;
  gvcnName: string;
  updatedAt?: string;
}): Promise<Blob | null> {
  const { sessions, palette, className, schoolYear, gvcnName, updatedAt } = input;
  const width = PAD * 2 + COL_PERIOD + COL_DAY * DAY_LABELS.length;
  const height =
    PAD * 2 +
    TITLE_H +
    sessions.reduce((total, session) => total + sessionHeight(session), 0) +
    GAP * Math.max(0, sessions.length - 1) +
    FOOT_H;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);

  // Chờ font tải xong, nếu không canvas sẽ vẽ bằng font dự phòng
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* vẽ với font hiện có */
    }
  }

  ctx.fillStyle = CARD;
  ctx.fillRect(0, 0, width, height);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("Thời khóa biểu", PAD, PAD + 18);
  ctx.fillStyle = INK_3;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(`Lớp ${className} · Năm học ${schoolYear}`, PAD, PAD + 46);

  ctx.fillStyle = "#e6e9f2";
  ctx.fillRect(PAD, PAD + TITLE_H - 14, width - PAD * 2, 1);

  let y = PAD + TITLE_H;
  sessions.forEach((session, index) => {
    y = drawSession(ctx, session, palette, y, PAD);
    if (index < sessions.length - 1) y += GAP;
  });

  ctx.textAlign = "left";
  ctx.fillStyle = INK_3;
  ctx.font = `500 11px ${FONT}`;
  const stamp = updatedAt ? `Cập nhật ${updatedAt} · ` : "";
  ctx.fillText(`${stamp}GVCN ${gvcnName}`, PAD, y + FOOT_H / 2 + 6);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // iOS Safari cũ bỏ qua thuộc tính download; mở tab để người dùng nhấn giữ lưu.
  if (!("download" in link)) window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
