import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Missing MONGODB_URI.");
}

const payloadPath = path.resolve(process.argv[2] || "scratch/xlsx_payload.json");
const raw = JSON.parse(await fs.readFile(payloadPath, "utf8"));
const reports = raw.reports ?? [];

function toCount(value) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeTeamScore(fields) {
  return (
    1000 -
    toCount(fields.not_prepared_count) * 50 -
    toCount(fields.no_homework_count) * 50 -
    toCount(fields.disorder_count) * 50 -
    toCount(fields.late_count) * 50 -
    toCount(fields.violation_count) * 50 -
    toCount(fields.absent_count) * 50 +
    toCount(fields.good_points_count) * 50 +
    toCount(fields.participation_count) * 5
  );
}

function computeTreasury(fields, previousRemaining = 0) {
  const totalIncome = toCount(fields.fee_per_student) * toCount(fields.quantity_paid);
  const totalExpense = [1, 2, 3, 4, 5, 6].reduce(
    (sum, index) => sum + toCount(fields[`expense_amount_${index}`]),
    0,
  );
  return {
    totalIncome,
    totalExpense,
    remaining: totalIncome - totalExpense + previousRemaining,
  };
}

const NAMES = {
  toTruong: (team) => `Tổ trưởng tổ ${team}`,
  lopTruong: "Lớp trưởng",
  lopPhoHocTap: "Lớp phó học tập",
  lopPhoLaoDong: "Lớp phó lao động",
  lopPhoPhongTrao: "Lớp phó phong trào",
  lopPhoTratTu: "Lớp phó trật tự",
  thuQuy: "Thủ quỹ",
  gvcn: "Giáo viên chủ nhiệm",
};

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

await client.connect();
const db = client.db("ptex_webchunhiem");
const schoolYear = await db.collection("schoolYears").findOne({ isCurrent: true });
if (!schoolYear?._id) {
  throw new Error("No current school year. Start the app once to seed, then re-run import.");
}

const now = new Date().toISOString();
let upserts = 0;
const remainingByWeek = new Map();

const ordered = [...reports].sort((a, b) => {
  if (a.reporterRole === "thuQuy" && b.reporterRole === "thuQuy") return a.weekNumber - b.weekNumber;
  return 0;
});

for (const item of ordered) {
  const fields = { ...item.fields };
  if (item.reporterRole === "toTruong") {
    fields.team_score = String(computeTeamScore(fields));
  }
  if (item.reporterRole === "thuQuy") {
    const previous = remainingByWeek.get(item.weekNumber - 1) ?? 0;
    const treasury = computeTreasury(fields, previous);
    fields.total_income = String(treasury.totalIncome);
    fields.total_expense = String(treasury.totalExpense);
    fields.remaining = String(treasury.remaining);
    remainingByWeek.set(item.weekNumber, treasury.remaining);
  }

  const filter = {
    schoolYearId: schoolYear._id,
    weekNumber: item.weekNumber,
    reporterRole: item.reporterRole,
    teamNumber: item.teamNumber ?? null,
  };
  const reporterName =
    item.reporterRole === "toTruong" ? NAMES.toTruong(item.teamNumber) : NAMES[item.reporterRole] ?? item.reporterRole;
  const payload = {
    schoolYearId: schoolYear._id,
    weekNumber: item.weekNumber,
    weekLabel: `Tuần ${item.weekNumber}`,
    reporterRole: item.reporterRole,
    reporterName,
    teamNumber: item.teamNumber ?? null,
    summary: fields.summary || fields.campaign_name || fields.notice_guild || fields.good_points || fields.team_score || "Đã nhập từ Excel",
    studyNotes: fields.good_points || fields.not_prepared_names || fields.speaking || "",
    disciplineNotes: fields.absent_student || fields.disorder_sdb || fields.disorder_names || "",
    activityNotes: fields.notice_guild || fields.progress || fields.social_media || "",
    financeNotes: fields.remaining || fields.fee_per_student || fields.estimated_cost || "",
    futurePlan: fields.future_plan || fields.feedback || fields.suggestions || "",
    fields,
    source: "xlsx",
    status: item.reporterRole === "gvcn" ? "reviewed" : "submitted",
    updatedBy: "xlsx-import",
    updatedAt: now,
  };

  const existing = await db.collection("weeklyReports").findOne(filter);
  if (existing?._id) {
    await db.collection("weeklyReports").updateOne({ _id: existing._id }, { $set: payload });
  } else {
    await db.collection("weeklyReports").insertOne({
      _id: randomUUID(),
      ...payload,
      createdBy: "xlsx-import",
      createdAt: now,
    });
  }
  upserts += 1;
}

await db.collection("auditLogs").insertOne({
  _id: randomUUID(),
  schoolYearId: schoolYear._id,
  entityType: "report",
  entityId: schoolYear._id,
  action: "import",
  summary: `Nhập ${upserts} báo cáo tuần từ 12c1cn.xlsx.`,
  actorId: "xlsx-import",
  actorName: "Excel import",
  actorRole: "admin",
  createdAt: now,
});

console.log(`Imported ${upserts} weekly reports into school year ${schoolYear.name}.`);
await client.close();
