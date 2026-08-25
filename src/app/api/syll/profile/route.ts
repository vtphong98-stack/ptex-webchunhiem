import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { hasSyllPass } from "@/lib/syll-access";
import { resolveSyllContext } from "@/lib/syll-store";
import { formatBirthDate } from "@/lib/team-roster";
import type { Student } from "@/lib/types";

/**
 * Hồ sơ em đã khai lần trước, để chọn lại tên là form hiện sẵn mọi thứ và em
 * chỉ sửa chỗ nào đổi.
 *
 * Đây là toàn bộ thông tin cá nhân của một học sinh nên chỉ trả về khi đã qua
 * cổng mật khẩu của lớp.
 */
export async function GET(request: Request) {
  const context = await resolveSyllContext();
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }
  if (!(await hasSyllPass(context.schoolYearId))) {
    return NextResponse.json({ error: "Cần nhập mật khẩu của lớp." }, { status: 401 });
  }

  const studentId = new URL(request.url).searchParams.get("studentId") ?? "";
  if (!studentId) {
    return NextResponse.json({ error: "Thiếu học sinh." }, { status: 400 });
  }

  const db = await getDb();
  const student = await db
    .collection<Student>("students")
    .findOne({ _id: studentId, schoolYearId: context.schoolYearId });
  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy học sinh." }, { status: 404 });
  }

  return NextResponse.json(
    {
      profile: {
        birthDate: formatBirthDate(student),
        birthPlace: student.birthPlace ?? "",
        gender: student.gender ?? "",
        ethnicity: student.ethnicity ?? "",
        policy: student.policy ?? "",
        conduct: student.conduct ?? "",
        academic: student.academic ?? "",
        addressGroup: student.addressGroup ?? "",
        addressWard: student.addressWard ?? "",
        addressProvince: student.addressProvince ?? "",
        fatherName: student.fatherName ?? "",
        fatherJob: student.fatherJob ?? "",
        motherName: student.motherName ?? "",
        motherJob: student.motherJob ?? "",
        contactPhone: student.contactPhone ?? student.parentPhone ?? "",
        motherPhone: student.motherPhone ?? "",
        studentPhone: student.studentPhone ?? "",
        email: student.email ?? "",
        idNumber: student.idNumber ?? "",
        weight: student.weight ?? "",
        height: student.height ?? "",
        canSwim: student.canSwim ?? "",
        eyeDisease: student.eyeDisease ?? "",
        medicalHistory: student.medicalHistory ?? "",
        transport: student.transport ?? "",
        onlineLearning: student.onlineLearning ?? "",
        notes: student.notes ?? "",
        // Chức vụ / tổ / chỗ ngồi để form chọn sẵn đúng ô em đang giữ.
        classDuty: student.classDuty ?? null,
        teamRole: student.teamRole ?? null,
        teamNumber: student.teamNumber ?? null,
        seatDesk: student.seatDesk ?? null,
        seatSide: student.seatSide ?? null,
        submittedAt: student.syllSubmittedAt ?? "",
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
