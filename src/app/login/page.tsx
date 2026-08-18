import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import { loginAction } from "@/app/login/actions";

const errorMessages: Record<string, string> = {
  missing: "Vui lòng nhập đầy đủ tài khoản và mật khẩu.",
  invalid: "Tài khoản hoặc mật khẩu chưa đúng.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : null;

  return (
    <main className="container py-8 md:py-14">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="card p-6 md:p-8">
          <div className="mb-6 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700">
            <LockKeyhole size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Đăng nhập hệ thống chủ nhiệm</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Mỗi chức vụ có tài khoản riêng để xem đúng module được phân công. GVCN và admin sẽ có
            đầy đủ dashboard quản trị lớp, phụ huynh, năm học và lịch sử chỉnh sửa.
          </p>

          <form action={loginAction} className="mt-8 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="username">
                Tài khoản
              </label>
              <input id="username" name="username" placeholder="admin, gvcn, loptruong, tt1..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                Mật khẩu
              </label>
              <input id="password" name="password" type="password" placeholder="Nhập mật khẩu" />
            </div>
            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <button className="button-primary w-full" type="submit">
              Đăng nhập
            </button>
          </form>
        </section>

        <aside className="card bg-slate-950 p-6 text-slate-50 md:p-8">
          <div className="mb-4 inline-flex rounded-2xl bg-white/10 p-3 text-blue-100">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-2xl font-semibold">Tài khoản seed mặc định</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
            <p>
              Hệ thống sẽ tự seed dữ liệu cũ vào MongoDB ở lần chạy đầu tiên. Đồng thời tạo sẵn các
              tài khoản khởi tạo cho admin, GVCN, lớp trưởng, lớp phó, thủ quỹ và tổ trưởng.
            </p>
            <p>
              Bạn có thể đổi thông tin tài khoản seed bằng các biến môi trường `SEED_ADMIN_*` và
              `SEED_GVCN_*`, sau đó quản lý các tài khoản còn lại trong dashboard admin.
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Khuyến nghị: sau khi đăng nhập lần đầu, đổi mật khẩu và cập nhật lại tài khoản thực tế
              cho ban cán sự lớp.
            </p>
            <Link className="inline-flex items-center font-semibold text-blue-200 hover:text-blue-100" href="/">
              Quay về trang giới thiệu
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
