import Link from "next/link";

import { TeachingPlanView } from "@/components/gvcn/TeacherWorkspace";
import { requireGvcn } from "@/lib/access";
import { CLASS_SITE } from "@/lib/class-site";
import { getTeachingPlanServer } from "@/lib/public-site";

export const revalidate = 60;

export const metadata = {
  title: `Phân Phối Chương Trình — ${CLASS_SITE.fullName}`,
  description: "Lịch báo giảng / PPCT Lớp 11 + Lớp 12",
};

export default async function BaoGiangPage() {
  await requireGvcn("/bao-giang");

  const plan = await getTeachingPlanServer();

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <section className="site-section block-teal">
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>📖 Phân Phối Chương Trình</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            Thầy {CLASS_SITE.gvcnName} · Năm học {CLASS_SITE.schoolYear}
          </p>
          <TeachingPlanView initialData={plan.data} />
        </section>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link className="button-secondary" href="/">← Quay lại trang chủ</Link>
        </div>
      </div>
    </main>
  );
}
