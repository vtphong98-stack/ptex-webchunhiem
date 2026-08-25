import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { applyDutyChange, findDutyConflict } from "@/lib/duty-store";
import { hasSyllPass } from "@/lib/syll-access";
import { SEAT_TEAMS, findSeatHolder, seatLabel, type Seat } from "@/lib/syll-seats";
import { resolveSyllContext } from "@/lib/syll-store";
import { normalizePersonName } from "@/lib/team-roster";
import { CLASS_DUTIES, type ClassDuty, type ParentContact, type Student, type TeamRole } from "@/lib/types";
import { toPlainString } from "@/lib/utils";

/**
 * Sơ yếu lý lịch do chính học sinh khai.
 *
 * Danh sách lớp là bản GVCN nhập từ file mẫu, nên form chỉ cho chọn tên có sẵn:
 * như vậy số thứ tự trong sổ gọi tên không bao giờ lệch và không sinh ra học
 * sinh trùng do gõ sai chính tả.
 */

/**
 * Ô "Chức vụ" trên form là một danh sách gộp: chức vụ lớp và chức vụ tổ nằm
 * chung. Chọn chức vụ lớp thì vai trò trong tổ về thành viên và ngược lại; em
 * nào giữ cùng lúc hai chức thì GVCN đặt thêm ở sơ đồ lớp.
 */
function readDuty(form: FormData) {
  const raw = toPlainString(form.get("duty"));
  const teamRaw = Number(toPlainString(form.get("teamNumber")));
  const teamNumber = SEAT_TEAMS.includes(teamRaw as (typeof SEAT_TEAMS)[number]) ? teamRaw : null;

  if ((CLASS_DUTIES as readonly string[]).includes(raw)) {
    return { classDuty: raw as ClassDuty, teamRole: "thanhVien" as TeamRole, teamNumber };
  }
  if (raw === "toTruong" || raw === "toPho") {
    return { classDuty: null, teamRole: raw as TeamRole, teamNumber };
  }
  return { classDuty: null, teamRole: (teamNumber ? "thanhVien" : null) as TeamRole | null, teamNumber };
}

function readSeat(form: FormData, teamNumber: number | null, deskCount: number): Seat | null | "invalid" {
  const desk = Number(toPlainString(form.get("seatDesk")));
  const side = toPlainString(form.get("seatSide"));
  if (!teamNumber || !desk || (side !== "trong" && side !== "ngoai")) return null;
  if (!Number.isInteger(desk) || desk < 1 || desk > deskCount) return "invalid";
  return { team: teamNumber, desk, side };
}

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
  // Danh sách lớp kèm chỗ ngồi chỉ mở sau cổng mật khẩu, cùng một mức bảo vệ
  // với hồ sơ đã khai mà form lấy về để điền sẵn.
  if (!(await hasSyllPass(context.schoolYearId))) {
    return NextResponse.json({ error: "Cần nhập mật khẩu của lớp." }, { status: 401 });
  }

  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find(
      { schoolYearId: context.schoolYearId },
      {
        projection: {
          fullName: 1,
          profileTt: 1,
          syllSubmittedAt: 1,
          teamNumber: 1,
          teamRole: 1,
          classDuty: 1,
          seatDesk: 1,
          seatSide: 1,
        },
      },
    )
    .toArray();

  return NextResponse.json(
    {
      className: context.info.className,
      yearName: context.yearName,
      deskCount: context.deskCount,
      // Tên, chỗ ngồi và chức vụ — vừa đủ để form khoá những ô đã có người.
      // Đây cũng chính là sơ đồ lớp dán trên tường, không phải thông tin riêng.
      // Mọi mục cá nhân khác không được trả về vì trang này ai cũng mở được.
      students: students
        .map((student) => ({
          _id: String(student._id),
          tt: student.profileTt ?? null,
          fullName: student.fullName,
          submitted: Boolean(student.syllSubmittedAt),
          teamNumber: student.teamNumber ?? null,
          teamRole: student.teamRole ?? null,
          classDuty: student.classDuty ?? null,
          seatDesk: student.seatDesk ?? null,
          seatSide: student.seatSide ?? null,
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
  if (!(await hasSyllPass(context.schoolYearId))) {
    return NextResponse.json({ error: "Cần nhập mật khẩu của lớp." }, { status: 401 });
  }
  if (context.syllLocked) {
    return NextResponse.json(
      { error: "GVCN đã chốt sổ sơ yếu lý lịch. Cần sửa thì báo thầy cô mở lại." },
      { status: 423 },
    );
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

  // Chức vụ / tổ / chỗ ngồi em tự chọn. Chỗ nào đã có người thì trả lỗi chứ
  // không đá bạn ra — bên GVCN mới có quyền điều người.
  const duty = readDuty(form);
  const seat = readSeat(form, duty.teamNumber, context.deskCount);
  if (seat === "invalid") {
    return NextResponse.json({ error: `Bàn phải từ 1 đến ${context.deskCount}.` }, { status: 400 });
  }

  const roster = await students
    .find(
      { schoolYearId: context.schoolYearId },
      { projection: { fullName: 1, teamNumber: 1, seatDesk: 1, seatSide: 1 } },
    )
    .toArray();
  if (seat) {
    const holder = findSeatHolder(roster, seat, String(targetId));
    if (holder) {
      return NextResponse.json(
        { error: `${seatLabel(seat)} đã có ${holder.fullName} ngồi. Chọn chỗ khác giúp thầy cô nhé.` },
        { status: 409 },
      );
    }
  }
  const clash = await findDutyConflict(context.schoolYearId, String(targetId), duty);
  if (clash) {
    return NextResponse.json(
      { error: `${clash.label} đã có ${clash.holderName}. Nếu sai, báo GVCN sửa lại giúp em.` },
      { status: 409 },
    );
  }

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
    motherPhone: toPlainString(form.get("motherPhone")),
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

  // Chức vụ đi qua applyDutyChange để nhãn chức vụ, sơ đồ lớp và tên trên tài
  // khoản đăng nhập của chức vụ đó cùng cập nhật một lượt.
  const saved = await students.findOne({ _id: targetId });
  if (saved) {
    await applyDutyChange(saved, {
      classDuty: duty.classDuty,
      teamRole: duty.teamRole,
      teamNumber: duty.teamNumber,
      seatDesk: seat?.desk ?? null,
      seatSide: seat?.side ?? null,
    });
  }

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
  revalidateTag("public-site", "max");

  return NextResponse.json({ ok: true, studentId: String(targetId), fullName });
}
