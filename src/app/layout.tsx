import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Lớp 12A1 - 2026-2027",
  description: "Web báo cáo ban cán sự và tổng kết tuần của giáo viên chủ nhiệm.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
