import { renderClassIcon } from "@/lib/app-icon";

export const size = { width: 96, height: 96 };
export const contentType = "image/png";
/** Tên lớp cả năm mới đổi một lần, không cần dựng lại icon mỗi lượt xem. */
export const revalidate = 3600;

export default function Icon() {
  return renderClassIcon(size.width);
}
