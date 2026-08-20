import Link from "next/link";

import { TeachingPlanView } from "@/components/gvcn/TeacherWorkspace";
import { requireGvcn } from "@/lib/access";
import { getTeachingPlanServer } from "@/lib/public-site";
import { getClassIdentity } from "@/lib/public-site";

export const revalidate = 60;

export async function generateMetadata() {
  const site = await getClassIdentity();
  return {
    title: `Phân Phối Chương Trình — ${site.fullName}`,
    description: "Lịch báo giảng / PPCT Lớp 11 + Lớp 12",
  };
}

export default async function BaoGiangPage() {
  const site = await getClassIdentity();
  await requireGvcn("/bao-giang");

  const plan = await getTeachingPlanServer();

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <section className="site-section block-teal">
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>📖 Phân Phối Chương Trình</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            {site.gvcnDisplayName} · Năm học {site.schoolYear}
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
