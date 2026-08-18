import { hash } from "bcryptjs";
import { MongoClient, ServerApiVersion } from "mongodb";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI.");
}

async function loadLegacy() {
  const root = process.cwd();
  const dataFile = await fs.readFile(path.join(root, "data.js"), "utf8");
  const parentsFile = await fs.readFile(path.join(root, "api", "parents.js"), "utf8");

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${dataFile}
this.__exports = { CLASS_INFO, GVCN_INFO, EXAM_INFO, STUDENTS };`, sandbox);

  const match = parentsFile.match(/return\s*(\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error("Cannot parse parent data.");
  }

  const parentSandbox = {};
  vm.createContext(parentSandbox);
  vm.runInContext(`this.__parents = ${match[1]}`, parentSandbox);

  return {
    ...sandbox.__exports,
    parents: parentSandbox.__parents,
  };
}

function buildWeeks(startDate, weekCount) {
  const weeks = [];
  const base = new Date(startDate);
  for (let index = 0; index < weekCount; index += 1) {
    const start = new Date(base);
    start.setDate(base.getDate() + index * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    weeks.push({
      weekNumber: index + 1,
      label: `Tuần ${index + 1}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  }
  return weeks;
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

await client.connect();
const db = client.db("ptex_webchunhiem");

const legacy = await loadLegacy();
const now = new Date().toISOString();
const currentYearId = crypto.randomUUID();

await db.collection("schoolYears").deleteMany({});
await db.collection("classConfigs").deleteMany({});
await db.collection("students").deleteMany({});
await db.collection("parents").deleteMany({});
await db.collection("users").deleteMany({});
await db.collection("weeklyReports").deleteMany({});
await db.collection("auditLogs").deleteMany({});

await db.collection("schoolYears").insertOne({
  _id: currentYearId,
  name: legacy.CLASS_INFO.schoolYear,
  label: `Năm học ${legacy.CLASS_INFO.schoolYear}`,
  startDate: new Date(`${legacy.CLASS_INFO.schoolYear.split("-")[0]}-08-15`).toISOString(),
  endDate: new Date(`${legacy.CLASS_INFO.schoolYear.split("-")[1]}-05-31`).toISOString(),
  weekCount: 35,
  weeks: buildWeeks(new Date(`${legacy.CLASS_INFO.schoolYear.split("-")[0]}-08-15`).toISOString(), 35),
  isCurrent: true,
  createdAt: now,
  updatedAt: now,
});

await db.collection("classConfigs").insertOne({
  _id: crypto.randomUUID(),
  schoolYearId: currentYearId,
  className: legacy.CLASS_INFO.className,
  fullName: legacy.CLASS_INFO.fullName,
  gvcnName: legacy.GVCN_INFO.name,
  gvcnDisplayName: legacy.GVCN_INFO.displayName,
  gvcnPhone: legacy.GVCN_INFO.phone,
  gvcnZalo: legacy.GVCN_INFO.zalo,
  examTitle: legacy.EXAM_INFO.hk1Title,
  examDate: legacy.EXAM_INFO.hk1DateFull,
  note: "Imported from legacy static site.",
  createdAt: now,
  updatedAt: now,
});

const students = legacy.STUDENTS.map((student) => {
  const match = legacy.parents.find((item) => item.name === student.name);
  return {
    _id: crypto.randomUUID(),
    schoolYearId: currentYearId,
    fullName: student.name,
    birthDay: student.birthDay,
    birthMonth: student.birthMonth,
    teamNumber: null,
    position: null,
    parentPhone: match?.phone ?? "",
    parentName: match ? `Phụ huynh ${student.name}` : "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
});

await db.collection("students").insertMany(students);
await db.collection("parents").insertMany(
  students.map((student) => ({
    _id: crypto.randomUUID(),
    schoolYearId: currentYearId,
    studentId: student._id,
    studentName: student.fullName,
    parentName: student.parentName || `Phụ huynh ${student.fullName}`,
    relationship: "Phụ huynh",
    phone: student.parentPhone,
    note: "",
    createdAt: now,
    updatedAt: now,
  })),
);

const accounts = [
  ["admin", process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!", "Quản trị hệ thống", "admin", null, "all"],
  ["gvcn", process.env.SEED_GVCN_PASSWORD ?? "ChangeMe123!", "Giáo viên chủ nhiệm", "gvcn", null, "current"],
  ["loptruong", "Loptruong@2026", "Tài khoản lớp trưởng", "lopTruong", null, "current"],
  ["lpht", "Lpht@2026", "Tài khoản lớp phó học tập", "lopPhoHocTap", null, "current"],
  ["lpld", "Lpld@2026", "Tài khoản lớp phó lao động", "lopPhoLaoDong", null, "current"],
  ["lppt", "Lppt@2026", "Tài khoản lớp phó phong trào", "lopPhoPhongTrao", null, "current"],
  ["lptt", "Lptt@2026", "Tài khoản lớp phó trật tự", "lopPhoTratTu", null, "current"],
  ["thuquy", "Thuquy@2026", "Tài khoản thủ quỹ", "thuQuy", null, "current"],
  ["tt1", "Tt1@2026", "Tài khoản tổ trưởng tổ 1", "toTruong", 1, "current"],
  ["tt2", "Tt2@2026", "Tài khoản tổ trưởng tổ 2", "toTruong", 2, "current"],
  ["tt3", "Tt3@2026", "Tài khoản tổ trưởng tổ 3", "toTruong", 3, "current"],
  ["tt4", "Tt4@2026", "Tài khoản tổ trưởng tổ 4", "toTruong", 4, "current"],
];

await db.collection("users").insertMany(
  await Promise.all(
    accounts.map(async ([username, password, fullName, role, teamNumber, schoolYearScope]) => ({
      _id: crypto.randomUUID(),
      username,
      passwordHash: await hash(password, 10),
      fullName,
      role,
      teamNumber,
      schoolYearScope,
      active: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    })),
  ),
);

await db.collection("auditLogs").insertOne({
  _id: crypto.randomUUID(),
  schoolYearId: currentYearId,
  entityType: "system",
  entityId: currentYearId,
  action: "import",
  summary: "Da import du lieu tu web cu sang MongoDB.",
  actorId: "script",
  actorName: "Legacy Import Script",
  actorRole: "admin",
  createdAt: now,
});

console.log("Legacy data imported successfully.");
await client.close();
