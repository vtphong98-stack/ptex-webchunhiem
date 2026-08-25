import { ImageResponse } from "next/og";

import { getClassIdentity } from "@/lib/public-site";

/**
 * Icon của trang lấy thẳng tên lớp trong setup.
 *
 * Trước là hai file SVG chép cứng "12A1" — lớp đổi tên rồi mà icon vẫn nằm đó,
 * hiện sai suốt trên tab trình duyệt và trên màn hình chính của điện thoại.
 */

const NAVY = "#132f52";
const NAVY_2 = "#1e3a5f";
const GOLD = "#f0b429";

/**
 * "12C5" xếp một hàng thì ở cỡ 16px của tab trình duyệt chỉ còn là vệt mờ.
 * Tách phần khối và phần lớp thành hai dòng, mỗi dòng hai ký tự thì còn đọc ra.
 */
export function splitClassName(raw: string) {
  const name = (raw || "").replace(/\s+/g, "").toUpperCase();
  if (!name) return { top: "12", bottom: "C5" };
  const match = name.match(/^(\d{1,2})(.+)$/);
  if (match) return { top: match[1], bottom: match[2] };
  const half = Math.ceil(name.length / 2);
  return { top: name.slice(0, half), bottom: name.slice(half) };
}

export async function renderClassIcon(px: number) {
  const site = await getClassIdentity();
  const { top, bottom } = splitClassName(site.className);
  // Dòng dưới là phần phân biệt lớp nên để to hơn; dòng nào dài thì tự thu lại
  // cho khỏi tràn khung.
  const bottomSize = px * (bottom.length > 3 ? 0.34 : 0.46);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(145deg, ${NAVY_2}, ${NAVY})`,
          // Bo góc như biểu tượng ứng dụng; giữ vừa phải để ở cỡ 16px trên tab
          // trình duyệt không ăn mất chữ.
          borderRadius: px * 0.22,
          color: "#fff",
          fontWeight: 900,
          letterSpacing: px * 0.01,
          lineHeight: 1,
        }}
      >
        <div style={{ display: "flex", fontSize: px * 0.3, color: GOLD }}>{top}</div>
        <div style={{ display: "flex", fontSize: bottomSize, marginTop: px * 0.04 }}>{bottom}</div>
      </div>
    ),
    { width: px, height: px },
  );
}
