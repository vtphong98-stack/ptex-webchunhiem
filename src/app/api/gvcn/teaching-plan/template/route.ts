import { NextResponse } from "next/server";

import { buildTeachingPlanTemplate } from "@/lib/excel-teaching-plan";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";

export async function GET() {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const buffer = buildTeachingPlanTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Mau_PPCT_BaoGiang.xlsx"`,
    },
  });
}
