import { NextResponse } from "next/server";

import { isClassOfficer } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import { getAllTeamRosters, getCurrentSchoolYearDoc, getTeamRosterStudents } from "@/lib/student-store";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !isClassOfficer(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await getCurrentSchoolYearDoc();
  if (!schoolYear?._id) {
    return NextResponse.json({ schoolYearId: "", teams: {} as Record<string, never>, teamStudents: [] });
  }

  const schoolYearId = String(schoolYear._id);
  const teamNumber = Number(new URL(request.url).searchParams.get("teamNumber"));

  if (teamNumber >= 1 && teamNumber <= 4) {
    const teamStudents = await getTeamRosterStudents(schoolYearId, teamNumber);
    return NextResponse.json({ schoolYearId, teamNumber, teamStudents });
  }

  const teams = await getAllTeamRosters(schoolYearId);
  return NextResponse.json({ schoolYearId, teams });
}
