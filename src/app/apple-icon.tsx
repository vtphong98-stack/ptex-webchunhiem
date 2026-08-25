import { renderClassIcon } from "@/lib/app-icon";

/** Cỡ Apple yêu cầu cho biểu tượng lưu ra màn hình chính. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const revalidate = 3600;

export default function AppleIcon() {
  return renderClassIcon(size.width);
}
