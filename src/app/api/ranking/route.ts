import { getDb } from "@/lib/db";
import { getTeamScoresForWeek } from "@/lib/report-schema";
import type { WeeklyReport } from "@/lib/types";

export const revalidate = 60;

export async function GET() {
  try {
    const db = await getDb();
    const schoolYear = await db.collection("schoolYears").findOne({ isCurrent: true }, { projection: { _id: 1 } });
    if (!schoolYear?._id) {
      return Response.json({ rankingWeek: 0, ranking: { scores: [], firstPlace: "" } });
    }

    const schoolYearId = String(schoolYear._id);
    const latest = await db.collection<WeeklyReport>("weeklyReports").findOne(
      { schoolYearId, reporterRole: "toTruong" },
      { sort: { weekNumber: -1 }, projection: { weekNumber: 1 } },
    );
    const rankingWeek = latest?.weekNumber ?? 0;
    const teamReports = rankingWeek
      ? await db
          .collection<WeeklyReport>("weeklyReports")
          .find(
            { schoolYearId, reporterRole: "toTruong", weekNumber: rankingWeek },
            { projection: { weekNumber: 1, reporterRole: 1, teamNumber: 1, fields: 1 } },
          )
          .toArray()
      : [];

    return Response.json({
      rankingWeek,
      ranking: rankingWeek ? getTeamScoresForWeek(teamReports, rankingWeek) : { scores: [], firstPlace: "" },
    });
  } catch {
    return Response.json({ rankingWeek: 0, ranking: { scores: [], firstPlace: "" } });
  }
}
