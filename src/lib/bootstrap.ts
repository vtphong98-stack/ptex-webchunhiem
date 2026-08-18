import { hash } from "bcryptjs";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { loadLegacySeedData } from "@/lib/legacy-loader";
import { getSeedUsers } from "@/lib/seed-users";
import type {
  AuditLog,
  ClassConfig,
  ParentContact,
  SchoolYear,
  Student,
  UserAccount,
} from "@/lib/types";
import { schoolYearLabelFromName } from "@/lib/utils";
import { buildExcelWeeks, EXCEL_WEEK_COUNT } from "@/lib/weeks";

let bootstrapPromise: Promise<void> | null = null;

function timestamp() {
  return new Date().toISOString();
}

async function insertMissingUsers() {
  const db = await getDb();
  const users = db.collection<UserAccount>("users");
  const accounts = getSeedUsers();
  const usernames = accounts.flatMap((account) => [account.username, ...(account.aliases ?? [])]);
  const existing = await users
    .find({ username: { $in: usernames } } as never)
    .project({ username: 1 })
    .toArray();
  const existingNames = new Set(existing.map((item) => item.username));
  const now = timestamp();

  for (const account of accounts) {
    const alreadyThere = [account.username, ...(account.aliases ?? [])].some((name) => existingNames.has(name));
    if (alreadyThere) continue;

    await users.insertOne({
      _id: new ObjectId().toHexString(),
      username: account.username,
      passwordHash: await hash(account.password, 10),
      fullName: account.fullName,
      role: account.role,
      teamNumber: account.teamNumber,
      schoolYearScope: account.role === "admin" ? "all" : "current",
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function ensureSchoolYearWeeks() {
  const db = await getDb();
  const weeks = buildExcelWeeks();
  const firstWeek = weeks.find((week) => week.startDate);
  const lastWeek = [...weeks].reverse().find((week) => week.endDate);
  const now = timestamp();
  await db.collection<SchoolYear>("schoolYears").updateMany(
    { isCurrent: true },
    {
      $set: {
        name: "2025-2026",
        label: schoolYearLabelFromName("2025-2026"),
        weekCount: EXCEL_WEEK_COUNT,
        weeks,
        startDate: firstWeek?.startDate,
        endDate: lastWeek?.endDate,
        updatedAt: now,
      },
    },
  );
  const current = await db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true });
  if (current?._id) {
    await db.collection<ClassConfig>("classConfigs").updateMany(
      { schoolYearId: current._id },
      {
        $set: {
          fullName: "Lớp 12C1 - 2025-2026",
          examTitle: "Thi học kỳ 1",
          examDate: "2025-12-29",
          updatedAt: now,
        },
      },
    );
  }
}

async function seedFromLegacy() {
  const db = await getDb();
  const legacy = await loadLegacySeedData();
  const now = timestamp();
  const weeks = buildExcelWeeks();
  const firstWeek = weeks.find((week) => week.startDate);
  const lastWeek = [...weeks].reverse().find((week) => week.endDate);
  const currentYearId = new ObjectId().toHexString();
  const schoolYear: SchoolYear = {
    _id: currentYearId,
    name: "2025-2026",
    label: schoolYearLabelFromName("2025-2026"),
    startDate: firstWeek?.startDate || new Date("2025-09-08").toISOString(),
    endDate: lastWeek?.endDate || new Date("2026-05-31").toISOString(),
    weekCount: EXCEL_WEEK_COUNT,
    weeks,
    isCurrent: true,
    createdAt: now,
    updatedAt: now,
  };

  const classConfig: ClassConfig = {
    _id: new ObjectId().toHexString(),
    schoolYearId: currentYearId,
    className: legacy.classInfo.className,
    fullName: "Lớp 12C1 - 2025-2026",
    gvcnName: legacy.gvcnInfo.name,
    gvcnDisplayName: legacy.gvcnInfo.displayName,
    gvcnPhone: legacy.gvcnInfo.phone,
    gvcnZalo: legacy.gvcnInfo.zalo,
    examTitle: "Thi học kỳ 1",
    examDate: "2025-12-29",
    note: "Du lieu duoc migrate tu web cu.",
    createdAt: now,
    updatedAt: now,
  };

  const students: Student[] = legacy.students.map((student) => {
    const parent = legacy.parents.find((item) => item.name === student.name);
    return {
      _id: new ObjectId().toHexString(),
      schoolYearId: currentYearId,
      fullName: student.name,
      birthDay: student.birthDay,
      birthMonth: student.birthMonth,
      birthYear: null,
      teamNumber: null,
      teamRole: null,
      classDuty: null,
      position: null,
      parentPhone: parent?.phone ?? "",
      parentName: parent ? `Phụ huynh ${student.name}` : "",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
  });

  const parents: ParentContact[] = students.map((student) => ({
    _id: new ObjectId().toHexString(),
    schoolYearId: currentYearId,
    studentId: student._id ?? null,
    studentName: student.fullName,
    parentName: student.parentName || `Phụ huynh ${student.fullName}`,
    relationship: "Phụ huynh",
    phone: student.parentPhone,
    note: "",
    createdAt: now,
    updatedAt: now,
  }));

  const users: UserAccount[] = [];
  for (const account of getSeedUsers()) {
    users.push({
      _id: new ObjectId().toHexString(),
      username: account.username,
      passwordHash: await hash(account.password, 10),
      fullName: account.fullName,
      role: account.role,
      teamNumber: account.teamNumber,
      schoolYearScope: account.role === "admin" ? "all" : "current",
      active: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  const auditLog: AuditLog = {
    _id: new ObjectId().toHexString(),
    schoolYearId: currentYearId,
    entityType: "system",
    entityId: currentYearId,
    action: "seed",
    summary: "Khoi tao du lieu tu web cu sang MongoDB.",
    actorId: users[0]?._id ?? "",
    actorName: users[0]?.fullName ?? "System",
    actorRole: "admin",
    createdAt: now,
  };

  await db.collection<SchoolYear>("schoolYears").insertOne(schoolYear);
  await db.collection<ClassConfig>("classConfigs").insertOne(classConfig);
  await db.collection<Student>("students").insertMany(students);
  await db.collection<ParentContact>("parents").insertMany(parents);
  await db.collection<UserAccount>("users").insertMany(users);
  await db.collection<AuditLog>("auditLogs").insertOne(auditLog);
}

async function ensureIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection("weeklyReports").createIndex({ schoolYearId: 1, reporterRole: 1, teamNumber: 1, weekNumber: -1 }),
    db.collection("schoolYears").createIndex({ isCurrent: 1 }),
    db.collection("students").createIndex({ schoolYearId: 1, fullName: 1 }),
    db.collection("weekLocks").createIndex({ schoolYearId: 1, weekNumber: 1 }, { unique: true }),
  ]);
}

async function bootstrapOnce() {
  const db = await getDb();
  const year =
    (await db.collection<SchoolYear>("schoolYears").findOne({ isCurrent: true }, { projection: { weeks: 1 } })) ??
    (await db.collection<SchoolYear>("schoolYears").findOne({}, { projection: { weeks: 1 } }));
  if (!year) {
    await seedFromLegacy();
    await ensureIndexes();
    return;
  }

  await insertMissingUsers();
  if (!year.weeks?.[0]?.dateRangeLabel) {
    await ensureSchoolYearWeeks();
  }
  await ensureIndexes();
}

export async function ensureSeedData() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapOnce().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  await bootstrapPromise;
}
