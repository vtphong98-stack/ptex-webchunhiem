"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { loginAction } from "@/app/login/actions";
import { CLASS_SITE } from "@/lib/class-site";

const errorMessages: Record<string, string> = {
  missing: "Vui lòng nhập mật khẩu.",
  invalid: "Tài khoản hoặc mật khẩu chưa đúng.",
};

const ROLE_COPY: Record<string, { title: string; username?: string; hint: string }> = {
  lt: { title: "Lớp trưởng (LT)", username: "lt", hint: "Tài khoản lt" },
  lpht: { title: "Lớp phó học tập (LPHT)", username: "lpht", hint: "Tài khoản lpht" },
  lpld: { title: "Lớp phó lao động (LPLD)", username: "lpld", hint: "Tài khoản lpld" },
  lppt: { title: "Lớp phó phong trào (LPPT)", username: "lppt", hint: "Tài khoản lppt" },
  lptt: { title: "Lớp phó trật tự (LPTT)", username: "lptt", hint: "Tài khoản lptt" },
  thuquy: { title: "Thủ quỹ", username: "thuquy", hint: "Tài khoản thuquy" },
  gvcn: { title: "Giáo viên chủ nhiệm", username: "gvcn", hint: "Tài khoản gvcn" },
  admin: { title: "Quản trị", username: "admin", hint: "Tài khoản admin" },
  tt: { title: "Tổ trưởng", hint: "Chọn tổ rồi đăng nhập tt1, tt2, tt3 hoặc tt4" },
  tt1: { title: "Tổ trưởng tổ 1", username: "tt1", hint: "Tài khoản tt1" },
  tt2: { title: "Tổ trưởng tổ 2", username: "tt2", hint: "Tài khoản tt2" },
  tt3: { title: "Tổ trưởng tổ 3", username: "tt3", hint: "Tài khoản tt3" },
  tt4: { title: "Tổ trưởng tổ 4", username: "tt4", hint: "Tài khoản tt4" },
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const userKey = searchParams.get("user") ?? "";
  const role = ROLE_COPY[userKey] ?? {
    title: "Đăng nhập báo cáo",
    hint: "Dùng tài khoản chức vụ: lt, lpht, lpld, lppt, lptt, tt1-tt4, thuquy, gvcn",
  };
  const errorKey = searchParams.get("error");
  const error = errorKey ? errorMessages[errorKey] : null;

  return (
    <main className="py-8">
      <div className="officer-form">
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Link className="button-primary" href="/">
            ← Trở về trang chủ
          </Link>
        </div>
        <h1>{CLASS_SITE.fullName}</h1>
        <h2>{role.title}</h2>

        {userKey === "tt" && !role.username ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {[1, 2, 3, 4].map((team) => (
              <Link className="button-secondary" href={{ pathname: "/login", query: { user: `tt${team}` } }} key={team}>
                Tổ {team}
              </Link>
            ))}
          </div>
        ) : (
          <form action={loginAction} className="space-y-4">
            {role.username ? (
              <input name="username" type="hidden" value={role.username} />
            ) : (
              <div>
                <label htmlFor="username">Tài khoản</label>
                <input id="username" name="username" placeholder="lt, lpht, tt1, thuquy..." />
              </div>
            )}
            <div>
              <label htmlFor="password">Mật khẩu thầy cấp cho chức vụ</label>
              <input id="password" name="password" placeholder="Nhập mật khẩu" type="password" />
            </div>
            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
                {error}
              </p>
            ) : (
              <p className="text-center text-sm text-slate-500">{role.hint}</p>
            )}
            <button className="button-primary w-full" type="submit">
              Đăng nhập và vào form báo cáo
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
