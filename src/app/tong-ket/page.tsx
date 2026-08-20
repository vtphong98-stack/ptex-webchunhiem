import Link from "next/link";

import { requireGvcn } from "@/lib/access";
import { CLASS_SITE } from "@/lib/class-site";
import { getHomeBoard } from "@/lib/home-board";
import { resolveSchoolYear } from "@/lib/school-year-scope";
import { buildExcelWeeks } from "@/lib/weeks";
import { WeeklyReportPublic } from "@/components/public/WeeklyReportPublic";

export const revalidate = 30;

export const metadata = {
  title: `Tổng kết lớp theo tuần · ${CLASS_SITE.fullName}`,
  description: "Tổng kết lớp hàng tuần — xếp hạng tổ, vi phạm, báo cáo chi tiết",
};

export default async function TongKetPage() {
  await requireGvcn("/tong-ket");

  const year = await resolveSchoolYear(undefined, { seed: false });
  const schoolYearId = year?._id ? String(year._id) : "";
  const board = await getHomeBoard(schoolYearId);
  const weeks = buildExcelWeeks().map((w) => ({
    weekNumber: w.weekNumber,
    label: w.label,
    dateRange: w.dateRangeLabel || "",
  }));

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <p className="mb-3"><Link href="/" className="text-sm text-indigo-600 hover:underline">← Trang chủ</Link></p>
        <section className="site-section block-blue">
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>📊 Tổng Kết Lớp Theo Tuần</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            {CLASS_SITE.fullName} · Năm học {CLASS_SITE.schoolYear}
          </p>
          <WeeklyReportPublic board={board} weeks={weeks} />
        </section>
      </div>
    </main>
  );
}
