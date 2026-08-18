import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "PTex Web Chủ Nhiệm",
  description: "Hệ thống chủ nhiệm số hóa theo năm học, phân quyền rõ theo vai trò.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
