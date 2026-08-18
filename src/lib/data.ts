import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import type {
  AppRole,
  AuditLog,
  ClassConfig,
  NavView,
  ParentContact,
  SchoolYear,
  SessionUser,
  Student,
  UserAccount,
  WeeklyReport,
} from "@/lib/types";
import { buildExcelWeeks, EXCEL_WEEK_COUNT } from "@/lib/weeks";

export async function getCurrentSchoolYear() {
  const db = await getDb();
  return db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true });
}

export async function getOfficerDashboardData(session: SessionUser) {
  const db = await getDb();
  const weeks = buildExcelWeeks();
  const schoolYear = await db.collection<SchoolYear>("schoolYears").findOne(
    { isCurrent: true },
    { projection: { _id: 1 } },
  );
  const reports = schoolYear?._id
    ? await db
        .collection<WeeklyReport>("weeklyReports")
        .find({
          schoolYearId: schoolYear._id,
          reporterRole: session.role,
          teamNumber: session.teamNumber ?? null,
        })
        .sort({ weekNumber: -1, updatedAt: -1 })
        .limit(20)
        .toArray()
    : [];

  return {
    schoolYear: {
      _id: schoolYear?._id,
      weekCount: EXCEL_WEEK_COUNT,
      weeks,
    },
    reports,
  };
}

/**
 * Dashboard data for admin views (overview, students, parents, accounts, audit).
 * GVCN reports view now uses client-side API routes — no board/weekReports here.
 */
export async function getDashboardData(
  selectedYearId?: string | null,
  view: NavView = "reports",
) {
  const db = await getDb();

  const schoolYears = await db
    .collection<SchoolYear>("schoolYears")
    .find({}, { projection: { name: 1, label: 1, startDate: 1, endDate: 1, weekCount: 1, isCurrent: 1 } })
    .sort({ startDate: -1 })
    .toArray();

  const currentSchoolYear =
    (selectedYearId
      ? schoolYears.find((item) => item._id === selectedYearId)
      : schoolYears.find((item) => item.isCurrent)) ?? schoolYears[0];

  if (!currentSchoolYear?._id) {
    throw new Error("No school year available.");
  }

  currentSchoolYear.weeks = buildExcelWeeks();
  currentSchoolYear.weekCount = EXCEL_WEEK_COUNT;

  const schoolYearId = currentSchoolYear._id;
  const loadStudents = view === "students";
  const loadParents = view === "parents";
  const loadAccounts = view === "accounts";
  const loadAudit = view === "audit";

  const [classConfig, studentCount, parentCount, students, parents, accounts, auditLogs] = await Promise.all([
    db.collection<ClassConfig>("classConfigs").findOne({ schoolYearId }),
    db.collection<Student>("students").countDocuments({ schoolYearId }),
    db.collection<ParentContact>("parents").countDocuments({ schoolYearId }),
    loadStudents
      ? db.collection<Student>("students").find({ schoolYearId }).sort({ fullName: 1 }).toArray()
      : Promise.resolve([]),
    loadParents
      ? db.collection<ParentContact>("parents").find({ schoolYearId }).sort({ studentName: 1 }).toArray()
      : Promise.resolve([]),
    loadAccounts ? db.collection<UserAccount>("users").find({}).sort({ role: 1, username: 1 }).toArray() : Promise.resolve([]),
    loadAudit
      ? db.collection<AuditLog>("auditLogs").find({ schoolYearId }).sort({ createdAt: -1 }).limit(30).toArray()
      : Promise.resolve([]),
  ]);

  return {
    schoolYears,
    currentSchoolYear,
    classConfig,
    studentCount,
    parentCount,
    students,
    parents,
    accounts,
    auditLogs,
  };
}

export function reportMatchesSlot(
  report: WeeklyReport,
  slot: { role: AppRole; teamNumber: number | null },
) {
  if (report.reporterRole !== slot.role) return false;
  if (slot.teamNumber == null) return report.teamNumber == null;
  return report.teamNumber === slot.teamNumber;
}

export async function createAuditLog(input: Omit<AuditLog, "_id" | "createdAt">) {
  const db = await getDb();
  await db.collection<AuditLog>("auditLogs").insertOne({
    _id: new ObjectId().toHexString(),
    ...input,
    createdAt: new Date().toISOString(),
  });
}
