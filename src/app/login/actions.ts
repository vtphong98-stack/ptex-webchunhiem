"use server";

import { compare } from "bcryptjs";

import { homePathForRole, nextPathForSession, redirectTo } from "@/lib/access";
import { ensureSeedData } from "@/lib/bootstrap";
import { createSession, getUserByUsername } from "@/lib/session";
import type { SessionUser } from "@/lib/types";
import { toPlainString } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const username = toPlainString(formData.get("username")).toLowerCase();
  const password = toPlainString(formData.get("password"));
  const nextUrl = toPlainString(formData.get("next")) || "";
  const userQuery = username ? `&user=${encodeURIComponent(username)}` : "";
  const nextQuery = nextUrl ? `&next=${encodeURIComponent(nextUrl)}` : "";

  if (!username || !password) {
    redirectTo(`/login?error=missing${userQuery}${nextQuery}`);
  }

  let user = await getUserByUsername(username);
  if (!user) {
    await ensureSeedData();
    user = await getUserByUsername(username);
  }

  if (!user || !user.active) {
    redirectTo(`/login?error=invalid${userQuery}${nextQuery}`);
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    redirectTo(`/login?error=invalid${userQuery}${nextQuery}`);
  }

  const session: SessionUser = {
    id: user._id ?? "",
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    teamNumber: user.teamNumber,
    schoolYearScope: user.schoolYearScope,
  };

  await createSession(session);

  // nextPathForSession rejects off-site targets ("//evil.com" is protocol
  // relative, so a bare startsWith("/") check is an open redirect) and refuses to
  // forward a session into the area it does not belong to.
  const next = nextPathForSession(session, nextUrl);
  redirectTo(next || homePathForRole(session.role, session.teamNumber));
}
