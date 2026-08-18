import { NextResponse } from "next/server";

import { canReviewReports } from "@/lib/permissions";
import { listSchoolYears } from "@/lib/school-year-scope";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !canReviewReports(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const years = await listSchoolYears();
  return NextResponse.json({
    years: years.map((year) => ({
      name: year.name,
      label: year.label,
      isCurrent: Boolean(year.isCurrent),
    })),
    current: years.find((year) => year.isCurrent)?.name ?? "",
  });
}
