"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";

import { ensureSeedData } from "@/lib/bootstrap";
import { createSession, getUserByUsername } from "@/lib/session";
import { toPlainString } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  await ensureSeedData();

  const username = toPlainString(formData.get("username")).toLowerCase();
  const password = toPlainString(formData.get("password"));
  const userQuery = username ? `&user=${encodeURIComponent(username)}` : "";

  if (!username || !password) {
    redirect(`/login?error=missing${userQuery}`);
  }

  const user = await getUserByUsername(username);

  if (!user || !user.active) {
    redirect(`/login?error=invalid${userQuery}`);
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    redirect(`/login?error=invalid${userQuery}`);
  }

  await createSession({
    id: user._id ?? "",
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    teamNumber: user.teamNumber,
    schoolYearScope: user.schoolYearScope,
  });

  redirect("/dashboard");
}
