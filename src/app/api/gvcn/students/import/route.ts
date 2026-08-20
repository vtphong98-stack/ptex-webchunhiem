import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { parseTeamWorkbook } from "@/lib/excel-teams";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import { getCurrentSchoolYearDoc } from "@/lib/student-store";
import {
  CLASS_DUTY_USERNAME,
  normalizePersonName,
  studentPositionLabel,
  teamLeaderUsername,
} from "@/lib/team-roster";
import type { ClassDuty, Student, TeamRole } from "@/lib/types";

function pickStudent(
  existing: Student[],
  used: Set<string>,
  fullName: string,
  birthDay: number,
  birthMonth: number,
) {
  const sameName = existing.filter(
    (student) => normalizePersonName(student.fullName) === normalizePersonName(fullName) && !used.has(String(student._id)),
  );
  if (!sameName.length) return null;
  if (sameName.length === 1) return sameName[0];
  return (
    sameName.find((student) => student.birthDay === birthDay && student.birthMonth === birthMonth) ?? sameName[0]
  );
}

async function syncLoginName(fullName: string, teamNumber: number, teamRole: TeamRole | null, classDuty: ClassDuty | null) {
  const db = await getDb();
  const now = new Date().toISOString();
  if (classDuty) {
    await db.collection("users").updateOne(
      { username: CLASS_DUTY_USERNAME[classDuty] },
      { $set: { fullName, updatedAt: now } },
    );
  }
  if (teamRole === "toTruong") {
    await db.collection("users").updateOne(
      { username: teamLeaderUsername(teamNumber) },
      { $set: { fullName, updatedAt: now } },
    );
  }
}

export async function POST(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schoolYear = await getCurrentSchoolYearDoc();
  if (!schoolYear?._id) {
    return NextResponse.json({ error: "Không có năm học hiện hành." }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Chưa chọn file Excel." }, { status: 400 });
  }

  const imported = parseTeamWorkbook(Buffer.from(await file.arrayBuffer()));
  if (!imported.length) {
    return NextResponse.json({ error: "File không có học sinh hợp lệ trong 4 tổ." }, { status: 400 });
  }

  const schoolYearId = String(schoolYear._id);
  const db = await getDb();
  const studentsCollection = db.collection<Student>("students");
  const existing = await studentsCollection.find({ schoolYearId }).toArray();
  const used = new Set<string>();
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  const firstRoleByTeam = new Map<number, { toTruong?: string; toPho?: string }>();

  for (const row of imported) {
    const teamFlags = firstRoleByTeam.get(row.teamNumber) ?? {};
    let teamRole = row.teamRole;
    if (teamRole === "toTruong") {
      if (teamFlags.toTruong) teamRole = "thanhVien";
      else teamFlags.toTruong = row.fullName;
    }
    if (teamRole === "toPho") {
      if (teamFlags.toPho) teamRole = "thanhVien";
      else teamFlags.toPho = row.fullName;
    }
    firstRoleByTeam.set(row.teamNumber, teamFlags);

    const match = pickStudent(existing, used, row.fullName, row.birthDay, row.birthMonth);
    const payload = {
      fullName: row.fullName,
      birthDay: row.birthDay,
      birthMonth: row.birthMonth,
      birthYear: row.birthYear,
      teamNumber: row.teamNumber,
      teamRole,
      classDuty: row.classDuty,
      position: studentPositionLabel({ teamRole, classDuty: row.classDuty, position: null }),
      notes: row.notes,
      updatedAt: now,
    };

    if (match?._id) {
      used.add(String(match._id));
      await studentsCollection.updateOne({ _id: match._id }, { $set: payload });
      updated += 1;
    } else {
      const createdAt = now;
      await studentsCollection.insertOne({
        _id: crypto.randomUUID(),
        schoolYearId,
        parentPhone: "",
        parentName: "",
        createdAt,
        ...payload,
      });
      created += 1;
    }

    await syncLoginName(row.fullName, row.teamNumber, teamRole, row.classDuty);
  }

  await createAuditLog({
    schoolYearId,
    entityType: "student",
    entityId: schoolYearId,
    action: "import",
    summary: `Nhập Excel chia tổ: thêm ${created}, cập nhật ${updated}.`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({ created, updated, total: imported.length });
}
