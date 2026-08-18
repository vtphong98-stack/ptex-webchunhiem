import { ObjectId } from "mongodb";

import { ensureSeedData } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import type {
  AuditLog,
  ClassConfig,
  ParentContact,
  SchoolYear,
  Student,
  UserAccount,
  WeeklyReport,
} from "@/lib/types";

export async function getCurrentSchoolYear() {
  await ensureSeedData();
  const db = await getDb();
  return db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true });
}

export async function getDashboardData(selectedYearId?: string | null) {
  await ensureSeedData();
  const db = await getDb();

  const schoolYears = await db
    .collection<SchoolYear>("schoolYears")
    .find({})
    .sort({ startDate: -1 })
    .toArray();

  const currentSchoolYear =
    (selectedYearId
      ? schoolYears.find((item) => item._id === selectedYearId)
      : schoolYears.find((item) => item.isCurrent)) ?? schoolYears[0];

  if (!currentSchoolYear?._id) {
    throw new Error("No school year available.");
  }

  const schoolYearId = currentSchoolYear._id;

  const [classConfig, students, parents, reports, accounts, auditLogs] = await Promise.all([
    db.collection<ClassConfig>("classConfigs").findOne({ schoolYearId }),
    db.collection<Student>("students").find({ schoolYearId }).sort({ fullName: 1 }).toArray(),
    db.collection<ParentContact>("parents").find({ schoolYearId }).sort({ studentName: 1 }).toArray(),
    db.collection<WeeklyReport>("weeklyReports").find({ schoolYearId }).sort({ weekNumber: -1, updatedAt: -1 }).toArray(),
    db.collection<UserAccount>("users").find({}).sort({ role: 1, username: 1 }).toArray(),
    db.collection<AuditLog>("auditLogs").find({ schoolYearId }).sort({ createdAt: -1 }).limit(30).toArray(),
  ]);

  return {
    schoolYears,
    currentSchoolYear,
    classConfig,
    students,
    parents,
    reports,
    accounts,
    auditLogs,
  };
}

export async function createAuditLog(input: Omit<AuditLog, "_id" | "createdAt">) {
  const db = await getDb();
  await db.collection<AuditLog>("auditLogs").insertOne({
    _id: new ObjectId().toHexString(),
    ...input,
    createdAt: new Date().toISOString(),
  });
}
