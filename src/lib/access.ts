import { redirect } from "next/navigation";

import { getVerifiedSessionUser } from "@/lib/session";
import { APP_ROLES, type AppRole, type SessionUser } from "@/lib/types";

/**
 * Single source of truth for who may enter which area.
 *
 * The site has exactly two protected areas:
 *  - "gvcn"    — the setup desk plus every teacher sub-page. One gvcn login
 *                covers all of them.
 *  - "officer" — the weekly report forms. Each officer only reaches their own.
 */
export type Area = "gvcn" | "officer";

/** Every page inside the teacher area. Keep in sync with GVCN_HOME_LINKS. */
export const GVCN_PATHS = [
  "/dashboard",
  "/tong-ket",
  "/chi-tieu",
  "/tra-cuu-hs",
  "/lien-he",
  "/lich-day",
  "/bao-giang",
] as const;

export type GvcnPath = (typeof GVCN_PATHS)[number];

export function isGvcnRole(role: AppRole) {
  return role === "gvcn" || role === "admin";
}

export function isOfficerRole(role: AppRole) {
  return !isGvcnRole(role);
}

export function areaOf(role: AppRole): Area {
  return isGvcnRole(role) ? "gvcn" : "officer";
}

/** Where a role lands after logging in, and where /login sends an active session. */
export function homePathForRole(role: AppRole, teamNumber: number | null): string {
  switch (role) {
    case "admin":
    case "gvcn":
      return "/dashboard";
    case "lopTruong":
      return "/bao-cao/lop-truong";
    case "lopPhoHocTap":
      return "/bao-cao/hoc-tap";
    case "lopPhoLaoDong":
      return "/bao-cao/lao-dong";
    case "lopPhoPhongTrao":
      return "/bao-cao/phong-trao";
    case "lopPhoTratTu":
      return "/bao-cao/trat-tu";
    case "thuQuy":
      return "/bao-cao/thu-quy";
    case "toTruong":
      return teamNumber ? `/bao-cao/to-truong?team=${teamNumber}` : "/bao-cao/to-truong";
    case "toPho":
      return teamNumber ? `/bao-cao/to-pho?team=${teamNumber}` : "/bao-cao/to-pho";
    default:
      return "/";
  }
}

/**
 * Sanitises a ?next= value.
 *
 * `startsWith("/")` alone is not enough: "//evil.com" and "/\\evil.com" are
 * protocol-relative and send the browser off-site, so a redirect built from an
 * unvetted next parameter is an open redirect.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "";
  const value = raw.trim();
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//") || value.startsWith("/\\")) return "";
  if (/[\r\n]/.test(value)) return "";
  return value;
}

/** Which area a path belongs to, or null when it is public. */
export function areaOfPath(path: string): Area | null {
  const clean = path.split("?")[0];
  if ((GVCN_PATHS as readonly string[]).includes(clean)) return "gvcn";
  if (clean === "/dashboard" || clean.startsWith("/dashboard/")) return "gvcn";
  if (clean.startsWith("/bao-cao")) return "officer";
  return null;
}

/** A session may only be forwarded to a ?next= inside its own area. */
export function nextPathForSession(session: SessionUser, raw: string | null | undefined): string {
  const next = safeNextPath(raw);
  if (!next) return "";
  const area = areaOfPath(next);
  if (area && area !== areaOf(session.role)) return "";
  return next;
}

/** Which area a ?user= key on the login page is asking for. */
export function areaOfUserKey(userKey: string): Area | null {
  const k = userKey.trim().toLowerCase();
  if (!k) return null;
  if (k === "gvcn" || k === "admin") return "gvcn";
  return "officer";
}

export function gvcnLoginUrl(nextPath: string) {
  return `/login?user=gvcn&next=${encodeURIComponent(nextPath)}`;
}

/** typedRoutes cannot type a route built at runtime; the callers below only ever
 *  pass paths from GVCN_PATHS or homePathForRole. */
type DynamicRoute = Parameters<typeof redirect>[0];

export function redirectTo(path: string): never {
  redirect(path as DynamicRoute);
}

/**
 * Gate for every teacher page. An officer session does NOT get bounced to its
 * own report form here — it is sent to the GVCN login form instead, otherwise a
 * student's leftover session locks the teacher out of their own setup area.
 */
export async function requireGvcn(nextPath: GvcnPath): Promise<SessionUser> {
  const session = await getVerifiedSessionUser();
  if (!session || !isGvcnRole(session.role)) {
    redirectTo(gvcnLoginUrl(nextPath));
  }
  return session;
}

export function isKnownRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}
