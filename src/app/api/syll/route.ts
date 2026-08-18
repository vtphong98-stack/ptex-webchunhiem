import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { syncSyllToGoogleSheets } from "@/lib/google-sheets";
import { resolveClassConfig, resolveSchoolYear } from "@/lib/school-year-scope";
import { normalizePersonName } from "@/lib/team-roster";
import type { ParentContact, Student } from "@/lib/types";
import { toPlainString } from "@/lib/utils";

function parseBirth(raw: string) {
  const match = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{4}))?$/);
  if (!match) return { birthDay: 1, birthMonth: 1, birthYear: null as number | null };
  return { birthDay: Number(match[1]), birthMonth: Number(match[2]), birthYear: match[3] ? Number(match[3]) : null };
}

export async function POST(request: Request) {
  const form = await request.formData();
  const fullName = toPlainString(form.get("fullName"));
  const tt = Number(toPlainString(form.get("tt")) || "0");
  if (!fullName || tt < 1) {
    return NextResponse.json({ error: "Cần họ tên và số thứ tự (TT)." }, { status: 400 });
  }

  const year = await resolveSchoolYear();
  const schoolYearId = year?._id ? String(year._id) : "";
  if (!schoolYearId) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }

  const birth = parseBirth(toPlainString(form.get("birthDate")));
  const contactPhone = toPlainString(form.get("contactPhone"));
  const studentPhone = toPlainString(form.get("studentPhone"));
  const fatherName = toPlainString(form.get("fatherName"));
  const motherName = toPlainString(form.get("motherName"));
  const now = new Date().toISOString();
  const db = await getDb();
  const students = db.collection<Student>("students");
  const roster = await students.find({ schoolYearId }, { projection: { fullName: 1, profileTt: 1 } }).toArray();
  const existingMeta =
    roster.find((item) => item.profileTt === tt) ??
    roster.find((item) => normalizePersonName(item.fullName) === normalizePersonName(fullName));
  const existing = existingMeta?._id ? await students.findOne({ _id: existingMeta._id }) : null;

  const fields: Partial<Student> = {
    fullName,
    ...birth,
    birthPlace: toPlainString(form.get("birthPlace")),
    gender: toPlainString(form.get("gender")),
    ethnicity: toPlainString(form.get("ethnicity")),
    policy: toPlainString(form.get("policy")),
    addressGroup: toPlainString(form.get("addressGroup")),
    addressWard: toPlainString(form.get("addressWard")),
    addressProvince: toPlainString(form.get("addressProvince")),
    fatherName,
    fatherJob: toPlainString(form.get("fatherJob")),
    motherName,
    motherJob: toPlainString(form.get("motherJob")),
    contactPhone,
    parentPhone: contactPhone,
    parentName: motherName || fatherName || `Phụ huynh ${fullName}`,
    classRole: toPlainString(form.get("classRole")),
    conduct: toPlainString(form.get("conduct")),
    academic: toPlainString(form.get("academic")),
    email: toPlainString(form.get("email")),
    idNumber: toPlainString(form.get("idNumber")),
    studentPhone,
    weight: toPlainString(form.get("weight")),
    height: toPlainString(form.get("height")),
    canSwim: toPlainString(form.get("canSwim")),
    eyeDisease: toPlainString(form.get("eyeDisease")),
    medicalHistory: toPlainString(form.get("medicalHistory")),
    transport: toPlainString(form.get("transport")),
    onlineLearning: toPlainString(form.get("onlineLearning")),
    profileTt: tt,
    notes: toPlainString(form.get("notes")),
    updatedAt: now,
  };

  let studentId = existing?._id ? String(existing._id) : "";
  if (existing?._id) {
    await students.updateOne({ _id: existing._id }, { $set: fields });
  } else {
    studentId = new ObjectId().toHexString();
    await students.insertOne({
      _id: studentId,
      schoolYearId,
      teamNumber: null,
      teamRole: null,
      classDuty: null,
      position: toPlainString(form.get("classRole")) || null,
      createdAt: now,
      ...fields,
    } as Student);
  }

  const parents = db.collection<ParentContact>("parents");
  const parentFilter = { schoolYearId, studentId };
  const parentPayload = {
    schoolYearId,
    studentId,
    studentName: fullName,
    parentName: fields.parentName || `Phụ huynh ${fullName}`,
    relationship: "Phụ huynh",
    phone: contactPhone,
    note: [fatherName && `Cha: ${fatherName}`, motherName && `Mẹ: ${motherName}`].filter(Boolean).join(" · "),
    updatedAt: now,
  };
  const parentDoc = await parents.findOne(parentFilter);
  if (parentDoc?._id) {
    await parents.updateOne({ _id: parentDoc._id }, { $set: parentPayload });
  } else {
    await parents.insertOne({
      _id: new ObjectId().toHexString(),
      createdAt: now,
      ...parentPayload,
    });
  }

  const sheetFields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    sheetFields[key] = String(value ?? "");
  }
  let sheets = await syncSyllToGoogleSheets(sheetFields);
  if (!sheets.ok && sheetFields.action !== "edit") {
    sheets = await syncSyllToGoogleSheets({ ...sheetFields, action: "edit" });
  }

  return NextResponse.json({
    ok: true,
    studentId,
    sheetsSynced: sheets.ok,
    className: (await resolveClassConfig(schoolYearId))?.fullName ?? "",
  });
}
