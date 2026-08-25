import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { resolveSyllContext } from "@/lib/syll-store";
import { normalizePersonName } from "@/lib/team-roster";
import type { ParentContact, Student } from "@/lib/types";
import { toPlainString } from "@/lib/utils";

/**
 * Sơ yếu lý lịch do chính học sinh khai.
 *
 * Danh sách lớp là bản GVCN nhập từ file mẫu, nên form chỉ cho chọn tên có sẵn:
 * như vậy số thứ tự trong sổ gọi tên không bao giờ lệch và không sinh ra học
 * sinh trùng do gõ sai chính tả.
 */

function parseBirth(raw: string) {
  const match = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{4}))?$/);
  if (!match) return { birthDay: 0, birthMonth: 0, birthYear: null as number | null };
  return {
    birthDay: Number(match[1]),
    birthMonth: Number(match[2]),
    birthYear: match[3] ? Number(match[3]) : null,
  };
}

export async function GET() {
  const context = await resolveSyllContext();
  if (!context) {
    return NextResponse.json({ className: "", yearName: "", students: [] });
  }

  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find({ schoolYearId: context.schoolYearId }, { projection: { fullName: 1, profileTt: 1, syllSubmittedAt: 1 } })
    .toArray();

  return NextResponse.json(
    {
      className: context.info.className,
      yearName: context.yearName,
      // Chỉ tên và trạng thái đã khai — mọi thông tin cá nhân khác không được
      // trả về đây vì trang này ai cũng mở được.
      students: students
        .map((student) => ({
          _id: String(student._id),
          tt: student.profileTt ?? null,
          fullName: student.fullName,
          submitted: Boolean(student.syllSubmittedAt),
        }))
        .sort((a, b) => (a.tt ?? 1e9) - (b.tt ?? 1e9) || a.fullName.localeCompare(b.fullName, "vi")),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const context = await resolveSyllContext();
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }

  const db = await getDb();
  const students = db.collection<Student>("students");
  const studentId = toPlainString(form.get("studentId"));
  const fullNameInput = toPlainString(form.get("fullName"));

  const student = studentId
    ? await students.findOne({ _id: studentId, schoolYearId: context.schoolYearId })
    : null;
  const fallback = student
    ? null
    : await students
        .find({ schoolYearId: context.schoolYearId }, { projection: { fullName: 1 } })
        .toArray()
        .then((list) =>
          list.find((item) => normalizePersonName(item.fullName) === normalizePersonName(fullNameInput)),
        );

  const targetId = student?._id ?? fallback?._id;
  if (!targetId) {
    return NextResponse.json(
      { error: "Không tìm thấy tên em trong danh sách lớp. Báo GVCN bổ sung danh sách rồi khai lại." },
      { status: 400 },
    );
  }

  const fullName = student?.fullName ?? fallback?.fullName ?? fullNameInput;
  const birth = parseBirth(toPlainString(form.get("birthDate")));
  const contactPhone = toPlainString(form.get("contactPhone"));
  const fatherName = toPlainString(form.get("fatherName"));
  const motherName = toPlainString(form.get("motherName"));
  const now = new Date().toISOString();

  // Không đụng tới classRole/classDuty/teamRole: chức vụ do GVCN bổ nhiệm bên
  // khu vực chủ nhiệm, học sinh tự khai thì mỗi em một kiểu và sơ đồ lớp sẽ sai.
  const fields: Partial<Student> = {
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
    conduct: toPlainString(form.get("conduct")),
    academic: toPlainString(form.get("academic")),
    email: toPlainString(form.get("email")),
    idNumber: toPlainString(form.get("idNumber")),
    studentPhone: toPlainString(form.get("studentPhone")),
    weight: toPlainString(form.get("weight")),
    height: toPlainString(form.get("height")),
    canSwim: toPlainString(form.get("canSwim")),
    eyeDisease: toPlainString(form.get("eyeDisease")),
    medicalHistory: toPlainString(form.get("medicalHistory")),
    transport: toPlainString(form.get("transport")),
    onlineLearning: toPlainString(form.get("onlineLearning")),
    notes: toPlainString(form.get("notes")),
    syllSubmittedAt: now,
    updatedAt: now,
  };

  await students.updateOne({ _id: targetId }, { $set: fields });

  const parents = db.collection<ParentContact>("parents");
  const parentPayload = {
    schoolYearId: context.schoolYearId,
    studentId: String(targetId),
    studentName: fullName,
    parentName: fields.parentName || `Phụ huynh ${fullName}`,
    relationship: "Phụ huynh",
    phone: contactPhone,
    note: [fatherName && `Cha: ${fatherName}`, motherName && `Mẹ: ${motherName}`].filter(Boolean).join(" · "),
    updatedAt: now,
  };
  const parentDoc = await parents.findOne({ schoolYearId: context.schoolYearId, studentId: String(targetId) });
  if (parentDoc?._id) {
    await parents.updateOne({ _id: parentDoc._id }, { $set: parentPayload });
  } else {
    await parents.insertOne({ _id: crypto.randomUUID(), createdAt: now, ...parentPayload });
  }

  revalidateTag("contacts", "max");

  return NextResponse.json({ ok: true, studentId: String(targetId), fullName });
}
