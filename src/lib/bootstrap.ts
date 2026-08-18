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
import { buildWeeks, schoolYearLabelFromName } from "@/lib/utils";

function timestamp() {
  return new Date().toISOString();
}

export async function ensureSeedUsers() {
  const db = await getDb();
  const users = db.collection<UserAccount>("users");
  const now = timestamp();

  for (const account of getSeedUsers()) {
    const existing = await users.findOne({
      username: { $in: [account.username, ...(account.aliases ?? [])] } as never,
    });

    if (!existing) {
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
      continue;
    }

    const update: Partial<UserAccount> = {
      username: account.username,
      fullName: account.fullName,
      role: account.role,
      teamNumber: account.teamNumber,
      active: true,
      updatedAt: now,
    };

    if (account.resetPassword) {
      update.passwordHash = await hash(account.password, 10);
    }

    await users.updateOne({ _id: existing._id }, { $set: update });
  }
}

export async function ensureSeedData() {
  const db = await getDb();
  const hasSchoolYear = await db.collection<SchoolYear>("schoolYears").countDocuments();
  if (hasSchoolYear > 0) {
    await ensureSeedUsers();
    return;
  }

  const legacy = await loadLegacySeedData();
  const now = timestamp();
  const currentYearId = new ObjectId().toHexString();
  const schoolYear: SchoolYear = {
    _id: currentYearId,
    name: legacy.classInfo.schoolYear,
    label: schoolYearLabelFromName(legacy.classInfo.schoolYear),
    startDate: new Date(`${legacy.classInfo.schoolYear.split("-")[0]}-08-15`).toISOString(),
    endDate: new Date(`${legacy.classInfo.schoolYear.split("-")[1]}-05-31`).toISOString(),
    weekCount: 35,
    weeks: buildWeeks(new Date(`${legacy.classInfo.schoolYear.split("-")[0]}-08-15`).toISOString(), 35),
    isCurrent: true,
    createdAt: now,
    updatedAt: now,
  };

  const classConfig: ClassConfig = {
    _id: new ObjectId().toHexString(),
    schoolYearId: currentYearId,
    className: legacy.classInfo.className,
    fullName: legacy.classInfo.fullName,
    gvcnName: legacy.gvcnInfo.name,
    gvcnDisplayName: legacy.gvcnInfo.displayName,
    gvcnPhone: legacy.gvcnInfo.phone,
    gvcnZalo: legacy.gvcnInfo.zalo,
    examTitle: legacy.examInfo.hk1Title,
    examDate: legacy.examInfo.hk1DateFull,
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
      teamNumber: null,
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
