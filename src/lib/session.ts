import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { getDb } from "@/lib/db";
import type { SessionUser, UserAccount } from "@/lib/types";

const SESSION_COOKIE = "ptex_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET environment variable.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const verified = await jwtVerify(token, getSecret());
    return verified.payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  return db.collection<UserAccount>("users").findOne({ username });
}
