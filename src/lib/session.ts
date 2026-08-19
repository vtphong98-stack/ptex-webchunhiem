import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { getDb } from "@/lib/db";
import type { SessionUser, UserAccount } from "@/lib/types";
import { USERNAME_ALIASES } from "@/lib/seed-users";

const SESSION_COOKIE = "ptex_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

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
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
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
  const normalized = username.toLowerCase();
  const canonical = USERNAME_ALIASES[normalized] ?? normalized;
  return db.collection<UserAccount>("users").findOne({
    username: { $in: [normalized, canonical] } as never,
  });
}
