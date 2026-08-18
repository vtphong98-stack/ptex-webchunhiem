import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

export function formatRoleLabel(role: string) {
  const map: Record<string, string> = {
    admin: "Quản trị",
    gvcn: "Giáo viên chủ nhiệm",
    lopTruong: "Lớp trưởng",
    lopPhoHocTap: "Lớp phó học tập",
    lopPhoLaoDong: "Lớp phó lao động",
    lopPhoPhongTrao: "Lớp phó phong trào",
    lopPhoTratTu: "Lớp phó trật tự",
    toTruong: "Tổ trưởng",
    toPho: "Tổ phó",
    thuQuy: "Thủ quỹ",
  };

  return map[role] ?? role;
}

export function formatDate(iso?: string | null) {
  if (!iso) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function schoolYearLabelFromName(name: string) {
  return `Năm học ${name}`;
}

export function buildWeeks(startDate: string, weekCount: number) {
  const weeks = [];
  const base = new Date(startDate);

  for (let index = 0; index < weekCount; index += 1) {
    const start = new Date(base);
    start.setDate(base.getDate() + index * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    weeks.push({
      weekNumber: index + 1,
      label: `Tuần ${index + 1}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  }

  return weeks;
}

export function toPlainString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function toNumberOrNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
