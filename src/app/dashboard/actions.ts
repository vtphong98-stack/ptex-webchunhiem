"use server";

import { hash } from "bcryptjs";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import { createAuditLog, getDashboardData } from "@/lib/data";
import {
  canManageAccounts,
  canManageParents,
  canManageSchoolYears,
  canManageStudents,
  canSubmitReport,
} from "@/lib/permissions";
import { getReportFields } from "@/lib/report-fields";
import { enrichReportFields } from "@/lib/report-schema";
import { clearSession, requireSessionUser } from "@/lib/session";
import type { AppRole } from "@/lib/types";
import { APP_ROLES } from "@/lib/types";
import { buildWeeks, toNumberOrNull, toPlainString } from "@/lib/utils";
import { getExcelWeek } from "@/lib/weeks";

function requirePermission(condition: boolean) {
  if (!condition) {
    throw new Error("FORBIDDEN");
  }
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
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
    birthYear: toNumberOrNull(formData.get("birthYear")),
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
    const newStudent = {
      _id: crypto.randomUUID(),
      schoolYearId,
      teamRole: null,
      classDuty: null,
      ...payload,
      createdAt,
    };
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
  requirePermission(canSubmitReport(session.role));

  const db = await getDb();
  const reportsCollection = db.collection<any>("weeklyReports");
  let schoolYearId = toPlainString(formData.get("schoolYearId"));
  if (!schoolYearId) {
    const currentYear = await db.collection("schoolYears").findOne({ isCurrent: true }, { projection: { _id: 1 } });
    schoolYearId = currentYear?._id ? String(currentYear._id) : "";
  }
  const weekNumber = Number(toPlainString(formData.get("weekNumber")) || "1");
  const week = getExcelWeek(weekNumber);
  const weekLabel = week?.label ?? `Tuần ${weekNumber}`;
  const rawFields: Record<string, string> = {};
  for (const field of getReportFields(session.role)) {
    rawFields[field.name] = toPlainString(formData.get(field.name));
  }
  if (week?.dateRangeLabel) {
    rawFields.week_range = week.dateRangeLabel;
  }

  let previousRemaining = 0;
  if (session.role === "thuQuy" && weekNumber > 1) {
    const previous = await reportsCollection.findOne({
      schoolYearId,
      weekNumber: weekNumber - 1,
      reporterRole: "thuQuy",
    });
    previousRemaining = Number(previous?.fields?.remaining || 0) || 0;
  }

  const fields = enrichReportFields(session.role, rawFields, previousRemaining);

  const payload = {
    weekNumber,
    weekLabel,
    reporterRole: session.role,
    reporterName: session.fullName,
    teamNumber: session.teamNumber ?? null,
    summary: fields.summary || fields.campaign_name || fields.class_weekly_review || fields.study_attitude || fields.team_score || "Đã nộp báo cáo tuần",
    studyNotes: fields.study_attitude || fields.study_attitude_reason || fields.not_prepared_names || "",
    disciplineNotes: fields.class_weekly_review || fields.disorder_sdb || fields.disorder_names || "",
    activityNotes: fields.guild_bgh_notice || fields.progress || fields.social_media || "",
    financeNotes: fields.remaining || fields.fee_per_student || fields.estimated_cost || "",
    futurePlan: fields.direction_plan || fields.future_plan || fields.feedback || fields.suggestions || "",
    fields,
    source: "form" as const,
    status: "submitted" as const,
    updatedBy: session.id,
    updatedAt: new Date().toISOString(),
  };

  const existing = await reportsCollection.findOne({
    schoolYearId,
    weekNumber,
    reporterRole: session.role,
    teamNumber: session.teamNumber ?? null,
  });

  if (existing?._id) {
    await reportsCollection.updateOne({ _id: existing._id }, { $set: payload });
    await createAuditLog({
      schoolYearId,
      entityType: "report",
      entityId: existing._id,
      action: "update",
      summary: `Cập nhật báo cáo ${payload.weekLabel}.`,
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
      summary: `Nộp báo cáo ${payload.weekLabel}.`,
      actorId: session.id,
      actorName: session.fullName,
      actorRole: session.role,
    });
  }

  revalidateTag("home", "max");
  revalidatePath("/");
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
