import Link from "next/link";

import { TeacherTimetableView } from "@/components/gvcn/TeacherWorkspace";
import { requireGvcn } from "@/lib/access";
import { getTeacherTimetableServer } from "@/lib/public-site";
import { getClassIdentity } from "@/lib/public-site";

export const revalidate = 60;

export async function generateMetadata() {
  const site = await getClassIdentity();
  return {
    title: `Lịch Dạy GV — ${site.fullName}`,
    description: "Lịch dạy giáo viên theo 3 buổi: Sáng, Chiều, Tối",
  };
}

export default async function LichDayPage() {
  const site = await getClassIdentity();
  await requireGvcn("/lich-day");

  const timetable = await getTeacherTimetableServer();

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <section className="site-section block-blue">
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>📅 Lịch Dạy Giáo Viên</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            {site.gvcnDisplayName} · Năm học {site.schoolYear}
          </p>
          <TeacherTimetableView initialGrid={timetable.data} />
        </section>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link className="button-secondary" href="/">← Quay lại trang chủ</Link>
        </div>
      </div>
    </main>
  );
}
