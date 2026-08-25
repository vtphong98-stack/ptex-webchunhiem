import Link from "next/link";

import { AttendanceManager } from "@/components/gvcn/AttendanceManager";
import { requireGvcn } from "@/lib/access";
import { getClassIdentity } from "@/lib/public-site";
import { resolveSchoolYear } from "@/lib/school-year-scope";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const site = await getClassIdentity();
  return {
    title: `Điểm danh · ${site.fullName}`,
    description: `Điểm danh theo dịp lớp ${site.className}`,
  };
}

/**
 * Điểm danh đứng riêng một trang, bấm một cái từ trang chủ là vào — thay vì
 * phải qua khu vực setup rồi mới tìm thẻ. Cùng một công cụ với tab trong setup,
 * chỉ khác chỗ đứng.
 */
export default async function DiemDanhPage() {
  await requireGvcn("/diem-danh");
  const site = await getClassIdentity();
  const year = await resolveSchoolYear();

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell space-y-4">
        <div className="flex items-center justify-between">
          <Link className="text-sm text-indigo-600 font-bold hover:underline" href="/">
            ← Trang chủ
          </Link>
          <Link className="text-sm text-slate-600 font-bold hover:underline" href="/dashboard">
            ⚙️ Khu vực setup
          </Link>
        </div>

        <p className="text-sm text-slate-500">
          Lớp {site.className} · {year?.name ?? ""} · GVCN {site.gvcnDisplayName}
        </p>

        <AttendanceManager readOnly={!year?.isCurrent} yearName={year?.name ?? ""} />
      </div>
    </main>
  );
}
