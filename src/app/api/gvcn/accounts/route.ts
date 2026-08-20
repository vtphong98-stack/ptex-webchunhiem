import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { isGvcnRole, isOfficerRole } from "@/lib/access";
import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { getVerifiedSessionUser } from "@/lib/session";
import { formatRoleLabel } from "@/lib/utils";
import type { UserAccount } from "@/lib/types";

const MIN_PASSWORD = 6;

/**
 * Lets the homeroom teacher reset the class officers' passwords without going
 * through the admin account. A gvcn session may only touch officer accounts —
 * resetting admin or another teacher would be a privilege escalation.
 */
export async function GET() {
  const session = await getVerifiedSessionUser();
  if (!session || !isGvcnRole(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const rows = await db
    .collection<UserAccount>("users")
    .find({}, { projection: { username: 1, fullName: 1, role: 1, teamNumber: 1, active: 1, updatedAt: 1 } })
    .sort({ role: 1, username: 1 })
    .toArray();

  const isAdmin = session.role === "admin";
  return NextResponse.json(
    {
      accounts: rows
        .filter((row) => isAdmin || isOfficerRole(row.role))
        .map((row) => ({
          id: String(row._id),
          username: row.username,
          fullName: row.fullName,
          role: row.role,
          roleLabel: formatRoleLabel(row.role),
          teamNumber: row.teamNumber ?? null,
          active: row.active !== false,
          updatedAt: row.updatedAt ?? "",
          // A username-equals-password account is trivially guessable.
          weakHint: row.username.length < MIN_PASSWORD,
        })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !isGvcnRole(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; password?: string; active?: boolean };
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "Thiếu tài khoản." }, { status: 400 });

  const db = await getDb();
  const users = db.collection<UserAccount>("users");
  const target = await users.findOne({ _id: id } as never, { projection: { username: 1, role: 1 } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });

  if (session.role !== "admin" && !isOfficerRole(target.role)) {
    return NextResponse.json(
      { error: "Chỉ tài khoản admin mới đổi được mật khẩu GVCN / admin." },
      { status: 403 },
    );
  }

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const changes: string[] = [];

  if (typeof body.password === "string" && body.password.length) {
    if (body.password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.` }, { status: 400 });
    }
    if (body.password.toLowerCase() === target.username.toLowerCase()) {
      return NextResponse.json({ error: "Mật khẩu không được trùng tên tài khoản." }, { status: 400 });
    }
    update.passwordHash = await hash(body.password, 10);
    changes.push("mật khẩu");
  }

  if (typeof body.active === "boolean") {
    update.active = body.active;
    changes.push(body.active ? "mở tài khoản" : "tạm dừng tài khoản");
  }

  if (!changes.length) return NextResponse.json({ error: "Không có gì để đổi." }, { status: 400 });

  await users.updateOne({ _id: id } as never, { $set: update });
  await createAuditLog({
    schoolYearId: null,
    entityType: "user",
    entityId: id,
    // Never record the password itself.
    action: "update",
    summary: `Đổi ${changes.join(" và ")} của ${target.username}.`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ ok: true, changed: changes });
}
