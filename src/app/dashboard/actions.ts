"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { createAuditLog, getDashboardData } from "@/lib/data";
import {
  canManageAccounts,
  canManageParents,
  canManageSchoolYears,
  canManageStudents,
  canReviewReports,
} from "@/lib/permissions";
import { clearSession, requireSessionUser } from "@/lib/session";
import type { AppRole } from "@/lib/types";
import { APP_ROLES } from "@/lib/types";
import { buildWeeks, toNumberOrNull, toPlainString } from "@/lib/utils";

function requirePermission(condition: boolean) {
  if (!condition) {
    throw new Error("FORBIDDEN");
  }
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function saveStudentAction(formData: FormData) {
  const session = await requireSessionUser();
  requirePermission(canManageStudents(session.role));

  const db = await getDb();
  const studentsCollection = db.collection<any>("students");
  const parentsCollection = db.collection<any>("parents");
  const schoolYearId = toPlainString(formData.get("schoolYearId"));
  const studentId = toPlainString(formData.get("studentId"));
  const payload = {
    fullName: toPlainString(formData.get("fullName")),
    birthDay: Number(toPlainString(formData.get("birthDay")) || "1"),
    birthMonth: Number(toPlainString(formData.get("birthMonth")) || "1"),
    teamNumber: toNumberOrNull(formData.get("teamNumber")),
    position: toPlainString(formData.get("position")) || null,
    parentPhone: toPlainString(formData.get("parentPhone")),
    parentName: toPlainString(formData.get("parentName")),
    notes: toPlainString(formData.get("notes")),
    updatedAt: new Date().toISOString(),
  };

  if (studentId) {
    await studentsCollection.updateOne({ _id: studentId }, { $set: payload });
    await parentsCollection.updateOne(
        { studentId, schoolYearId },
        {
          $set: {
            studentName: payload.fullName,
            parentName: payload.parentName,
            phone: payload.parentPhone,
            updatedAt: payload.updatedAt,
          },
        },
      );
    await createAuditLog({
      schoolYearId,
      entityType: "student",
      entityId: studentId,
      action: "update",
      summary: `Cap nhat hoc sinh ${payload.fullName}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  } else {
    const createdAt = new Date().toISOString();
    const newStudent = { _id: crypto.randomUUID(), schoolYearId, ...payload, createdAt };
    await studentsCollection.insertOne(newStudent);
    await parentsCollection.insertOne({
      _id: crypto.randomUUID(),
      schoolYearId,
      studentId: newStudent._id,
      studentName: payload.fullName,
      parentName: payload.parentName,
      relationship: "Phụ huynh",
      phone: payload.parentPhone,
      note: "",
      createdAt,
      updatedAt: createdAt,
    });
    await createAuditLog({
      schoolYearId,
      entityType: "student",
      entityId: newStudent._id,
      action: "create",
      summary: `Them hoc sinh ${payload.fullName}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  }

  revalidatePath("/dashboard");
}

export async function saveParentAction(formData: FormData) {
  const session = await requireSessionUser();
  requirePermission(canManageParents(session.role));

  const db = await getDb();
  const parentsCollection = db.collection<any>("parents");
  const parentId = toPlainString(formData.get("parentId"));
  const schoolYearId = toPlainString(formData.get("schoolYearId"));
  const payload = {
    studentName: toPlainString(formData.get("studentName")),
    parentName: toPlainString(formData.get("parentName")),
    relationship: toPlainString(formData.get("relationship")) || "Phụ huynh",
    phone: toPlainString(formData.get("phone")),
    note: toPlainString(formData.get("note")),
    updatedAt: new Date().toISOString(),
  };

  if (parentId) {
    await parentsCollection.updateOne({ _id: parentId }, { $set: payload });
    await createAuditLog({
      schoolYearId,
      entityType: "parent",
      entityId: parentId,
      action: "update",
      summary: `Cap nhat lien he phu huynh cho ${payload.studentName}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  } else {
    const createdAt = new Date().toISOString();
    const newParent = {
      _id: crypto.randomUUID(),
      schoolYearId,
      studentId: null,
      ...payload,
      createdAt,
    };
    await parentsCollection.insertOne(newParent);
    await createAuditLog({
      schoolYearId,
      entityType: "parent",
      entityId: newParent._id,
      action: "create",
      summary: `Them lien he phu huynh cho ${payload.studentName}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  }

  revalidatePath("/dashboard");
}

export async function saveReportAction(formData: FormData) {
  const session = await requireSessionUser();
  const db = await getDb();
  const reportsCollection = db.collection<any>("weeklyReports");
  const schoolYearId = toPlainString(formData.get("schoolYearId"));
  const reportId = toPlainString(formData.get("reportId"));
  const payload = {
    weekNumber: Number(toPlainString(formData.get("weekNumber")) || "1"),
    weekLabel: toPlainString(formData.get("weekLabel")) || "Tuần mới",
    reporterRole: session.role,
    reporterName: session.fullName,
    teamNumber: session.teamNumber,
    summary: toPlainString(formData.get("summary")),
    studyNotes: toPlainString(formData.get("studyNotes")),
    disciplineNotes: toPlainString(formData.get("disciplineNotes")),
    activityNotes: toPlainString(formData.get("activityNotes")),
    financeNotes: toPlainString(formData.get("financeNotes")),
    futurePlan: toPlainString(formData.get("futurePlan")),
    status: (toPlainString(formData.get("status")) || "submitted") as "draft" | "submitted" | "reviewed",
    updatedBy: session.id,
    updatedAt: new Date().toISOString(),
  };

  if (reportId) {
    const existing = await reportsCollection.findOne({ _id: reportId });
    const isOwner = existing?.createdBy === session.id;
    requirePermission(isOwner || canReviewReports(session.role));
    await reportsCollection.updateOne({ _id: reportId }, { $set: payload });
    await createAuditLog({
      schoolYearId,
      entityType: "report",
      entityId: reportId,
      action: "update",
      summary: `Cap nhat bao cao ${payload.weekLabel}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  } else {
    const createdAt = new Date().toISOString();
    const newReport = {
      _id: crypto.randomUUID(),
      schoolYearId,
      ...payload,
      createdBy: session.id,
      createdAt,
    };
    await reportsCollection.insertOne(newReport);
    await createAuditLog({
      schoolYearId,
      entityType: "report",
      entityId: newReport._id,
      action: "create",
      summary: `Them bao cao ${payload.weekLabel}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  }

  revalidatePath("/dashboard");
}

export async function saveSchoolYearAction(formData: FormData) {
  const session = await requireSessionUser();
  requirePermission(canManageSchoolYears(session.role));

  const db = await getDb();
  const schoolYearsCollection = db.collection<any>("schoolYears");
  const classConfigsCollection = db.collection<any>("classConfigs");
  const schoolYearId = toPlainString(formData.get("schoolYearId"));
  const name = toPlainString(formData.get("name"));
  const startDate = toPlainString(formData.get("startDate"));
  const endDate = toPlainString(formData.get("endDate"));
  const weekCount = Number(toPlainString(formData.get("weekCount")) || "35");
  const updatedAt = new Date().toISOString();
  const payload = {
    name,
    label: `Năm học ${name}`,
    startDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate).toISOString(),
    weekCount,
    weeks: buildWeeks(new Date(startDate).toISOString(), weekCount),
    updatedAt,
  };

  if (schoolYearId) {
    await schoolYearsCollection.updateOne({ _id: schoolYearId }, { $set: payload });
    await createAuditLog({
      schoolYearId,
      entityType: "schoolYear",
      entityId: schoolYearId,
      action: "update",
      summary: `Cap nhat ${payload.label}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  } else {
    const createdAt = new Date().toISOString();
    const newSchoolYearId = crypto.randomUUID();
    await schoolYearsCollection.insertOne({
      _id: newSchoolYearId,
      ...payload,
      isCurrent: false,
      createdAt,
    });

    const currentData = await getDashboardData();
    if (currentData.classConfig) {
      await classConfigsCollection.insertOne({
        ...currentData.classConfig,
        _id: crypto.randomUUID(),
        schoolYearId: newSchoolYearId,
        createdAt,
        updatedAt: createdAt,
      });
    }

    await createAuditLog({
      schoolYearId: newSchoolYearId,
      entityType: "schoolYear",
      entityId: newSchoolYearId,
      action: "create",
      summary: `Tao moi ${payload.label}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  }

  revalidatePath("/dashboard");
}

export async function setCurrentSchoolYearAction(formData: FormData) {
  const session = await requireSessionUser();
  requirePermission(canManageSchoolYears(session.role));

  const db = await getDb();
  const schoolYearsCollection = db.collection<any>("schoolYears");
  const schoolYearId = toPlainString(formData.get("schoolYearId"));
  await schoolYearsCollection.updateMany({}, { $set: { isCurrent: false } });
  await schoolYearsCollection.updateOne({ _id: schoolYearId }, { $set: { isCurrent: true, updatedAt: new Date().toISOString() } });

  await createAuditLog({
    schoolYearId,
    entityType: "schoolYear",
    entityId: schoolYearId,
    action: "setCurrent",
    summary: "Chuyen nam hoc hien hanh.",
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  revalidatePath("/dashboard");
}

export async function saveUserAction(formData: FormData) {
  const session = await requireSessionUser();
  requirePermission(canManageAccounts(session.role));

  const db = await getDb();
  const usersCollection = db.collection<any>("users");
  const userId = toPlainString(formData.get("userId"));
  const role = toPlainString(formData.get("role")) as AppRole;
  if (!APP_ROLES.includes(role)) {
    throw new Error("Vai tro khong hop le.");
  }

  const username = toPlainString(formData.get("username")).toLowerCase();
  const password = toPlainString(formData.get("password"));
  const payload = {
    username,
    fullName: toPlainString(formData.get("fullName")),
    role,
    teamNumber: toNumberOrNull(formData.get("teamNumber")),
    schoolYearScope: (toPlainString(formData.get("schoolYearScope")) || "current") as "all" | "current",
    active: toPlainString(formData.get("active")) !== "false",
    mustChangePassword: true,
    updatedAt: new Date().toISOString(),
  };

  if (userId) {
    const updatePayload: Record<string, unknown> = { ...payload };
    if (password) {
      updatePayload.passwordHash = await hash(password, 10);
    }
    await usersCollection.updateOne({ _id: userId }, { $set: updatePayload });
    await createAuditLog({
      schoolYearId: null,
      entityType: "user",
      entityId: userId,
      action: "update",
      summary: `Cap nhat tai khoan ${username}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  } else {
    const createdAt = new Date().toISOString();
    const newUser = {
      _id: crypto.randomUUID(),
      ...payload,
      passwordHash: await hash(password || "ChangeMe123!", 10),
      createdAt,
    };
    await usersCollection.insertOne(newUser);
    await createAuditLog({
      schoolYearId: null,
      entityType: "user",
      entityId: newUser._id,
      action: "create",
      summary: `Them tai khoan ${username}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  }

  revalidatePath("/dashboard");
}
