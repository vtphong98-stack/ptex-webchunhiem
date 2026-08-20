import { NextResponse } from "next/server";

import { isGvcnRole } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getVerifiedSessionUser } from "@/lib/session";
import { formatRoleLabel } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";

const PAGE_SIZE = 30;

/** Read-only activity log. Every write path already records into auditLogs. */
export async function GET(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !isGvcnRole(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);
  const entityType = searchParams.get("entityType") || "";

  const filter: Record<string, unknown> = {};
  if (entityType) filter.entityType = entityType;

  const db = await getDb();
  const rows = await db
    .collection<AuditLog>("auditLogs")
    .find(filter, {
      projection: { entityType: 1, entityId: 1, action: 1, summary: 1, actorName: 1, actorRole: 1, createdAt: 1 },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(PAGE_SIZE + 1)
    .toArray();

  const hasMore = rows.length > PAGE_SIZE;

  return NextResponse.json(
    {
      hasMore,
      entries: (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map((row) => ({
        id: String(row._id),
        entityType: row.entityType,
        action: row.action,
        summary: row.summary,
        actorName: row.actorName,
        actorRole: formatRoleLabel(row.actorRole),
        createdAt: row.createdAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
