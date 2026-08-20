import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";

import "@/app/globals.css";

// Be Vietnam Pro has no variable build, so every weight is a separate woff2 per
// subset and next/font preloads all of them. Five weights meant 10 preloaded
// files (92 KB) on the critical path of every page; three keeps it at 55 KB.
// 500 falls back to 400, and 800/900 to 700.
const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
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
