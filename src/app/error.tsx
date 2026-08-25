"use client";

import { useEffect } from "react";

/**
 * Màn hình khi trang dựng hỏng.
 *
 * Trước đây không có file này nên mọi lỗi ở phía máy chủ đổ thẳng ra màn hình
 * trắng kèm "Minified React error #441" — thầy cô không biết chuyện gì, cũng
 * không biết bấm gì. Hay gặp nhất là lúc Atlas bầu lại primary vài giây, tra
 * cứu học sinh đang mở là gãy.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-error">
      <div className="app-error-card">
        <span aria-hidden className="app-error-icon">
          ⚠️
        </span>
        <h1>Trang đang trục trặc</h1>
        <p>
          Thường là do kết nối tới cơ sở dữ liệu chập chờn vài giây. Bấm <b>Thử lại</b> là phần lớn trường hợp
          vào được ngay.
        </p>
        <div className="app-error-actions">
          <button className="button-primary" onClick={() => retry()} type="button">
            ↻ Thử lại
          </button>
          {/* Nạp lại hẳn chứ không đi bằng <Link>: lỗi có thể nằm ngay ở phần
              dữ liệu trang mà bộ định tuyến đang giữ. */}
          <button
            className="button-secondary"
            onClick={() => {
              window.location.href = "/";
            }}
            type="button"
          >
            Về trang chủ
          </button>
        </div>
        {error.digest ? <p className="app-error-digest">Mã lỗi: {error.digest}</p> : null}
      </div>
    </main>
  );
}
