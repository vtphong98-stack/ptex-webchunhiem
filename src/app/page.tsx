import Link from "next/link";
import { ArrowRight, BookOpen, Phone, ShieldCheck, Users2 } from "lucide-react";

import { getCurrentSchoolYear } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export default async function HomePage() {
  const schoolYear = await getCurrentSchoolYear();

  return (
    <main className="container px-0 py-6 md:py-10">
      <section className="card overflow-hidden p-6 md:p-10">
        <div className="grid gap-8 md:grid-cols-[1.35fr_0.9fr] md:items-center">
          <div className="space-y-5">
            <span className="badge">Web chủ nhiệm React + MongoDB</span>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-5xl">
                PTex Web Chủ Nhiệm được tái cấu trúc để quản lý lớp theo từng năm học.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                Hệ thống mới gom quản lý học sinh, phụ huynh, phân quyền ban cán sự, tổ trưởng,
                báo cáo tuần và cấu hình năm học vào một dashboard thống nhất, tối ưu cho điện
                thoại và cho giáo viên chủ nhiệm.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className="button-primary inline-flex items-center justify-center gap-2" href="/login">
                Đăng nhập quản trị
                <ArrowRight size={18} />
              </Link>
              <Link className="button-secondary inline-flex items-center justify-center gap-2" href="/dashboard">
                Xem dashboard hiện hành
              </Link>
            </div>
            <div className="grid-cards">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Năm học hiện hành</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {schoolYear?.label ?? "Chưa cấu hình"}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Tuần học mặc định</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {schoolYear?.weekCount ?? 0} tuần
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Khoảng thời gian</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatDate(schoolYear?.startDate)} - {formatDate(schoolYear?.endDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-slate-950 p-6 text-slate-50">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.25em] text-blue-200">Nghiệp vụ cốt lõi</p>
              <div className="space-y-4">
                <FeatureItem
                  icon={<ShieldCheck size={20} />}
                  title="Phân quyền rõ theo chức vụ"
                  description="Admin, GVCN, lớp trưởng, lớp phó, tổ trưởng, tổ phó và thủ quỹ dùng chung một hệ thống đăng nhập."
                />
                <FeatureItem
                  icon={<Users2 size={20} />}
                  title="Quản lý học sinh và chia tổ"
                  description="Lưu lịch sử theo năm học, theo dõi tổ, chức vụ, số điện thoại phụ huynh và chỉnh sửa có lưu vết."
                />
                <FeatureItem
                  icon={<BookOpen size={20} />}
                  title="Báo cáo tuần tập trung"
                  description="Tổ trưởng và lớp trưởng cập nhật báo cáo tuần, GVCN xem tổng hợp và rà soát trực tiếp trên dashboard."
                />
                <FeatureItem
                  icon={<Phone size={20} />}
                  title="Liên hệ phụ huynh trên di động"
                  description="Tra cứu số điện thoại nhanh, hiển thị ngay trong hồ sơ học sinh, thuận tiện khi dùng trên điện thoại."
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 inline-flex rounded-2xl bg-white/10 p-3 text-blue-100">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}
