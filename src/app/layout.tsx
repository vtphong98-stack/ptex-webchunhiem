import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";

import "@/app/globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lớp 12A1 - 2026-2027",
  description: "Web báo cáo ban cán sự và tổng kết tuần của giáo viên chủ nhiệm.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={beVietnam.className}>{children}</body>
    </html>
  );
}
