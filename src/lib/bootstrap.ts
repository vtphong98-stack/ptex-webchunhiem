import { hash } from "bcryptjs";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db";
import { loadLegacySeedData } from "@/lib/legacy-loader";
import type {
  AppRole,
  AuditLog,
  ClassConfig,
  ParentContact,
  SchoolYear,
  Student,
  UserAccount,
  WeeklyReport,
} from "@/lib/types";
import { buildWeeks, schoolYearLabelFromName } from "@/lib/utils";

function timestamp() {
  return new Date().toISOString();
}

type SeedUser = {
  username: string;
  password: string;
  fullName: string;
  role: AppRole;
  teamNumber: number | null;
};

function getSeedUsers(): SeedUser[] {
  return [
    {
      username: process.env.SEED_ADMIN_USERNAME ?? "admin",
      password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
      fullName: "Quản trị hệ thống",
      role: "admin",
      teamNumber: null,
    },
    {
      username: process.env.SEED_GVCN_USERNAME ?? "gvcn",
      password: process.env.SEED_GVCN_PASSWORD ?? "ChangeMe123!",
      fullName: "Giáo viên chủ nhiệm",
      role: "gvcn",
      teamNumber: null,
    },
    {
      username: "loptruong",
      password: "Loptruong@2026",
      fullName: "Tài khoản lớp trưởng",
      role: "lopTruong",
      teamNumber: null,
    },
    {
      username: "lpht",
      password: "Lpht@2026",
      fullName: "Tài khoản lớp phó học tập",
      role: "lopPhoHocTap",
      teamNumber: null,
    },
    {
      username: "lpld",
      password: "Lpld@2026",
      fullName: "Tài khoản lớp phó lao động",
      role: "lopPhoLaoDong",
      teamNumber: null,
    },
    {
      username: "lppt",
      password: "Lppt@2026",
      fullName: "Tài khoản lớp phó phong trào",
      role: "lopPhoPhongTrao",
      teamNumber: null,
    },
    {
      username: "lptt",
      password: "Lptt@2026",
      fullName: "Tài khoản lớp phó trật tự",
      role: "lopPhoTratTu",
      teamNumber: null,
    },
    {
      username: "thuquy",
      password: "Thuquy@2026",
      fullName: "Tài khoản thủ quỹ",
      role: "thuQuy",
      teamNumber: null,
    },
    {
      username: "tt1",
      password: "Tt1@2026",
      fullName: "Tài khoản tổ trưởng tổ 1",
      role: "toTruong",
      teamNumber: 1,
    },
    {
      username: "tt2",
      password: "Tt2@2026",
      fullName: "Tài khoản tổ trưởng tổ 2",
      role: "toTruong",
      teamNumber: 2,
    },
    {
      username: "tt3",
      password: "Tt3@2026",
      fullName: "Tài khoản tổ trưởng tổ 3",
      role: "toTruong",
      teamNumber: 3,
    },
    {
      username: "tt4",
      password: "Tt4@2026",
      fullName: "Tài khoản tổ trưởng tổ 4",
      role: "toTruong",
      teamNumber: 4,
    },
  ];
}

export async function ensureSeedData() {
  const db = await getDb();
  const hasSchoolYear = await db.collection<SchoolYear>("schoolYears").countDocuments();
  if (hasSchoolYear > 0) return;

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
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const seedReport: WeeklyReport = {
    _id: new ObjectId().toHexString(),
    schoolYearId: currentYearId,
    weekNumber: 1,
    weekLabel: "Tuần 1",
    reporterRole: "gvcn",
    reporterName: legacy.gvcnInfo.displayName,
    teamNumber: null,
    summary: "Du lieu mau sau khi chuyen he thong sang Next.js + MongoDB.",
    studyNotes: "Co the cap nhat theo tuan va phan quyen theo chuc vu.",
    disciplineNotes: "Lich su chinh sua se duoc luu trong audit logs.",
    activityNotes: "Dashboard da tach rieng cho GVCN, can su va to truong.",
    financeNotes: "Thu quy co the bao cao tai chinh theo tuan trong module bao cao.",
    futurePlan: "Cap nhat du lieu thuc te va bo sung tai khoan nguoi dung.",
    status: "reviewed",
    createdBy: users[1]?._id ?? "",
    updatedBy: users[1]?._id ?? "",
    createdAt: now,
    updatedAt: now,
  };

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
  await db.collection<WeeklyReport>("weeklyReports").insertOne(seedReport);
  await db.collection<AuditLog>("auditLogs").insertOne(auditLog);
}
