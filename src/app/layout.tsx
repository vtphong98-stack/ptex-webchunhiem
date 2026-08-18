import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import "@/app/globals.css";

const roboto = Roboto({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lớp 12C1 - 2025-2026",
  description: "Web báo cáo ban cán sự và tổng kết tuần của giáo viên chủ nhiệm.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={roboto.className}>{children}</body>
    </html>
  );
}
