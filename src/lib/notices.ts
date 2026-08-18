import type { GvcnNotice } from "@/lib/types";

export const NOTICE_NEW_DAYS = 7;
const NEW_MS = NOTICE_NEW_DAYS * 24 * 60 * 60 * 1000;

export type PublicNotice = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  isNew: boolean;
  dateLabel: string;
};

export function isNoticeNew(createdAt: string, now = Date.now()) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return now - created <= NEW_MS;
}

export function formatNoticeDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export function toPublicNotice(notice: GvcnNotice, newestId?: string): PublicNotice {
  return {
    id: String(notice._id),
    title: notice.title,
    body: notice.body,
    pinned: Boolean(notice.pinned),
    isNew: isNoticeNew(notice.createdAt) || String(notice._id) === newestId,
    dateLabel: formatNoticeDate(notice.createdAt),
  };
}

export function sortNotices(notices: GvcnNotice[]) {
  return [...notices].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}
