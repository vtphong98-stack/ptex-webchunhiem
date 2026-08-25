import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Cổng mật khẩu của trang khai sơ yếu lý lịch.
 *
 * Trang /syll phải mở được cho học sinh không có tài khoản, nhưng từ khi form
 * hiện lại thông tin đã khai thì nó không còn là trang công khai được nữa —
 * ngày sinh, CCCD, số điện thoại phụ huynh đều nằm sau đó. Một mật khẩu chung
 * của lớp là đủ: giữ người ngoài ở ngoài, mà học sinh vẫn không phải nhớ thêm
 * tài khoản riêng.
 *
 * Vé qua cổng là một cookie ký bằng AUTH_SECRET, gắn với đúng năm học, sống một
 * ngày — đủ cho một buổi khai, hết buổi thì hỏi lại.
 */

const SYLL_COOKIE = "ptex_syll";
const SYLL_MAX_AGE = 60 * 60 * 24;
const SYLL_ALG = "HS256";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET environment variable.");
  return new TextEncoder().encode(secret);
}

/** Mật khẩu mặc định là tên lớp viết thường — lớp 12C5 thì gõ "12c5". */
export function defaultSyllPassword(className: string) {
  return className.trim().toLowerCase().replace(/\s+/g, "");
}

export function resolveSyllPassword(stored: string | undefined, className: string) {
  return stored?.trim() || defaultSyllPassword(className);
}

/** So khớp không phân biệt hoa thường và khoảng trắng thừa hai đầu. */
export function syllPasswordMatches(input: string, expected: string) {
  return Boolean(expected) && input.trim().toLowerCase() === expected.trim().toLowerCase();
}

export async function grantSyllPass(schoolYearId: string) {
  const token = await new SignJWT({ schoolYearId })
    .setProtectedHeader({ alg: SYLL_ALG })
    .setIssuedAt()
    .setExpirationTime(`${SYLL_MAX_AGE}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(SYLL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SYLL_MAX_AGE,
  });
}

export async function hasSyllPass(schoolYearId: string) {
  const token = (await cookies()).get(SYLL_COOKIE)?.value;
  if (!token || !schoolYearId) return false;
  try {
    const verified = await jwtVerify(token, getSecret(), { algorithms: [SYLL_ALG] });
    return verified.payload.schoolYearId === schoolYearId;
  } catch {
    return false;
  }
}

export async function clearSyllPass() {
  (await cookies()).delete(SYLL_COOKIE);
}
