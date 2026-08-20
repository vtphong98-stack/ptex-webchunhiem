import { cookies } from "next/headers";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";

import { getDb } from "@/lib/db";
import { APP_ROLES, type AppRole, type SessionUser, type UserAccount } from "@/lib/types";
import { USERNAME_ALIASES } from "@/lib/seed-users";

const SESSION_COOKIE = "ptex_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years (persistent)
const SESSION_ALG = "HS256";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET environment variable.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: SESSION_ALG })
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

/**
 * A token that decodes but carries no usable role must be rejected outright.
 * Without this an old or hand-edited payload yields `role: undefined`, and every
 * "is this an officer?" test is written as "not admin and not gvcn" — so the
 * missing role would pass as an officer.
 */
function toSessionUser(payload: Record<string, unknown>): SessionUser | null {
  const role = payload.role;
  if (typeof role !== "string" || !(APP_ROLES as readonly string[]).includes(role)) return null;

  const teamNumber = payload.teamNumber;
  const scope = payload.schoolYearScope;

  return {
    id: typeof payload.id === "string" ? payload.id : "",
    username: typeof payload.username === "string" ? payload.username : "",
    fullName: typeof payload.fullName === "string" ? payload.fullName : "",
    role: role as AppRole,
    teamNumber: typeof teamNumber === "number" && Number.isFinite(teamNumber) ? teamNumber : null,
    schoolYearScope: scope === "all" ? "all" : "current",
  };
}

async function readSessionCookie(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    // Pin the algorithm instead of accepting whatever the token header claims.
    const verified = await jwtVerify(token, getSecret(), { algorithms: [SESSION_ALG] });
    return toSessionUser(verified.payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

export const getSessionUser = cache(readSessionCookie);

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

async function readLiveAccount(userId: string, username: string) {
  if (!userId && !username) return null;
  const db = await getDb();
  const or: Array<Record<string, unknown>> = [];
  if (userId) or.push({ _id: userId });
  if (username) or.push({ username });
  return db
    .collection<UserAccount>("users")
    .findOne({ $or: or } as never, { projection: { username: 1, role: 1, teamNumber: 1, active: 1 } });
}

const liveAccount = cache(readLiveAccount);

/**
 * Session check that also confirms the account still exists, is still active and
 * still holds the role the token claims.
 *
 * The cookie is a 10-year bearer token so the class officers never have to log in
 * again; the cost is that a plain signature check keeps honouring a token after
 * the account is disabled or demoted. Privileged (teacher) pages pay one extra
 * read to close that window — it is deduped per request by `cache`.
 */
export async function getVerifiedSessionUser(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  if (!session) return null;

  let account;
  try {
    account = await liveAccount(session.id, session.username);
  } catch {
    // Never lock the teacher out of their own site because Mongo blipped: the
    // signature already proved the token is ours.
    return session;
  }

  if (!account || account.active === false) return null;
  if (account.role !== session.role) return null;

  return { ...session, teamNumber: account.teamNumber ?? session.teamNumber };
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  const normalized = username.toLowerCase();
  const canonical = USERNAME_ALIASES[normalized] ?? normalized;
  return db.collection<UserAccount>("users").findOne({
    username: { $in: [normalized, canonical] } as never,
  });
}
