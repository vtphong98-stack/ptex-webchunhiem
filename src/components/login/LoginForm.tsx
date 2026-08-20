"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { loginAction } from "@/app/login/actions";
import { SubmitButton } from "@/components/SubmitButton";
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

export function LoginForm({
  signedInAs = "",
  switchingArea = false,
  userKeyOverride = "",
  nextOverride = "",
  siteName = "",
}: {
  /** Who is currently signed in, if anyone — so a leftover session is visible. */
  signedInAs?: string;
  /** True when that session belongs to the other area (student vs teacher). */
  switchingArea?: boolean;
  /** Preselect the account when the form is embedded on a page that already
   *  knows the role (the report pages), instead of relying on ?user=. */
  userKeyOverride?: string;
  nextOverride?: string;
  /** Tên lớp thật, truyền từ server; CLASS_SITE chỉ là dự phòng. */
  siteName?: string;
} = {}) {
  const searchParams = useSearchParams();
  const userKey = userKeyOverride || searchParams.get("user") || "";
  const nextUrl = nextOverride || searchParams.get("next") || "";
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
        <h1>{siteName || CLASS_SITE.fullName}</h1>
        <h2>{role.title}</h2>

        {signedInAs ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            Thiết bị này đang đăng nhập <strong>{signedInAs}</strong>.
            {switchingArea
              ? " Đăng nhập bên dưới để chuyển sang khu vực này."
              : " Đăng nhập bên dưới để đổi tài khoản."}
          </p>
        ) : null}

        {userKey === "tt" && !role.username ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {[1, 2, 3, 4].map((team) => (
              <a className="button-secondary" href={`/login?user=tt${team}${nextUrl ? `&next=${encodeURIComponent(nextUrl)}` : ""}`} key={team}>
                Tổ {team}
              </a>
            ))}
          </div>
        ) : (
          <form action={loginAction} className="space-y-4">
            {nextUrl ? <input name="next" type="hidden" value={nextUrl} /> : null}
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
            <SubmitButton className="button-primary w-full" pendingText="Đang đăng nhập…">
              Đăng nhập và vào form báo cáo
            </SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
