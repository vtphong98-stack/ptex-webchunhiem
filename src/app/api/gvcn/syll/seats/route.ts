import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/data";
import { getDb } from "@/lib/db";
import { applyDutyChange } from "@/lib/duty-store";
import { canManageStudents } from "@/lib/permissions";
import { getVerifiedSessionUser } from "@/lib/session";
import { SEAT_TEAMS, findSeatHolder, seatLabel, type SeatSide } from "@/lib/syll-seats";
import { loadSyllStudents, resolveSyllContext } from "@/lib/syll-store";
import { CLASS_DUTY_LABELS, TEAM_ROLE_LABELS } from "@/lib/team-roster";
import { CLASS_DUTIES, TEAM_ROLES, type ClassDuty, type Student, type TeamRole } from "@/lib/types";

type SeatPatch = {
  studentId?: string;
  teamNumber?: number | null;
  seatDesk?: number | null;
  seatSide?: SeatSide | null;
  teamRole?: TeamRole | null;
  classDuty?: ClassDuty | null;
};

function readTeam(value: unknown) {
  if (value === null) return null;
  const team = Number(value);
  return SEAT_TEAMS.includes(team as (typeof SEAT_TEAMS)[number]) ? team : undefined;
}

function readSide(value: unknown) {
  if (value === null) return null;
  return value === "trong" || value === "ngoai" ? (value as SeatSide) : undefined;
}

function readTeamRole(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return (TEAM_ROLES as readonly string[]).includes(String(value)) ? (value as TeamRole) : undefined;
}

function readClassDuty(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return (CLASS_DUTIES as readonly string[]).includes(String(value)) ? (value as ClassDuty) : undefined;
}

/**
 * Xếp chỗ ngồi và bổ nhiệm chức vụ ngay trên sơ đồ lớp.
 *
 * Một chỗ chỉ chứa được một em: nếu chỗ đích đã có người thì trả 409 kèm tên
 * em đang ngồi để GVCN biết phải dời ai trước. Phần chức vụ đi qua applyDutyChange
 * nên ràng buộc "mỗi tổ một tổ trưởng, mỗi chức vụ lớp một em" và việc đồng bộ
 * tên tài khoản đăng nhập giống hệt màn hình Ban cán sự.
 */
export async function PATCH(request: Request) {
  const session = await getVerifiedSessionUser();
  if (!session || !canManageStudents(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const context = await resolveSyllContext(new URL(request.url).searchParams.get("year"));
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }
  if (!context.isCurrent) {
    return NextResponse.json({ error: "Năm cũ chỉ xem." }, { status: 400 });
  }

  const body = (await request.json()) as SeatPatch;
  const studentId = String(body.studentId ?? "");
  if (!studentId) {
    return NextResponse.json({ error: "Thiếu học sinh." }, { status: 400 });
  }

  const roster = await loadSyllStudents(context.schoolYearId);
  const target = roster.find((student) => student._id === studentId);
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy học sinh." }, { status: 404 });
  }

  const team = body.teamNumber === undefined ? target.teamNumber ?? null : readTeam(body.teamNumber);
  const side = body.seatSide === undefined ? target.seatSide ?? null : readSide(body.seatSide);
  const deskRaw = body.seatDesk === undefined ? target.seatDesk ?? null : body.seatDesk;
  const desk = deskRaw === null ? null : Number(deskRaw);
  const teamRole = readTeamRole(body.teamRole);
  const classDuty = readClassDuty(body.classDuty);

  if (team === undefined) return NextResponse.json({ error: "Tổ không hợp lệ." }, { status: 400 });
  if (side === undefined) return NextResponse.json({ error: "Chỗ ngồi không hợp lệ." }, { status: 400 });
  if (teamRole === undefined && body.teamRole !== undefined) {
    return NextResponse.json({ error: "Chức vụ tổ không hợp lệ." }, { status: 400 });
  }
  if (classDuty === undefined && body.classDuty !== undefined) {
    return NextResponse.json({ error: "Chức vụ lớp không hợp lệ." }, { status: 400 });
  }
  if (desk !== null && (!Number.isInteger(desk) || desk < 1 || desk > context.deskCount)) {
    return NextResponse.json({ error: `Bàn phải từ 1 đến ${context.deskCount}.` }, { status: 400 });
  }
  if (teamRole && teamRole !== "thanhVien" && !team) {
    return NextResponse.json({ error: "Xếp em vào một tổ trước khi giao chức vụ tổ." }, { status: 400 });
  }

  const seat = team && desk && side ? { team, desk, side } : null;
  if (seat) {
    const holder = findSeatHolder(roster, seat, studentId);
    if (holder) {
      return NextResponse.json(
        {
          error: `${seatLabel(seat)} đã có ${holder.fullName}. Dời em đó trước khi xếp chỗ này.`,
          conflict: { studentId: holder._id, fullName: holder.fullName },
        },
        { status: 409 },
      );
    }
  }

  const db = await getDb();
  const student = await db.collection<Student>("students").findOne({ _id: studentId });
  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy học sinh." }, { status: 404 });
  }

  const result = await applyDutyChange(student, {
    teamNumber: team,
    seatDesk: desk,
    seatSide: side,
    ...(teamRole !== undefined ? { teamRole } : {}),
    ...(classDuty !== undefined ? { classDuty } : {}),
  });

  // Chuyển tổ thì chức vụ tổ không đi theo — nói thẳng ra để GVCN bổ nhiệm lại
  // chứ không phát hiện lúc in sơ đồ mới thấy mất tổ trưởng.
  const droppedTeamRole =
    teamRole === undefined &&
    team !== (student.teamNumber ?? null) &&
    (student.teamRole === "toTruong" || student.teamRole === "toPho")
      ? TEAM_ROLE_LABELS[student.teamRole]
      : "";

  // Trang chủ hiện tên em đang giữ chức, danh bạ hiện chức vụ — cả hai đọc qua
  // unstable_cache nên phải xả tag, không thì phải chờ tới 60 giây mới thấy.
  revalidateTag("public-site", "max");
  revalidateTag("contacts", "max");

  void createAuditLog({
    schoolYearId: context.schoolYearId,
    entityType: "student",
    entityId: studentId,
    action: "update",
    summary: seat
      ? `Xếp ${target.fullName} vào ${seatLabel(seat)}.`
      : `Bỏ chỗ ngồi của ${target.fullName}.`,
    actorId: session.id,
    actorName: session.fullName,
    actorRole: session.role,
  });

  return NextResponse.json({
    ok: true,
    student: result.student,
    peers: result.peers,
    notice: droppedTeamRole ? `${target.fullName} chuyển tổ nên thôi chức ${droppedTeamRole.toLowerCase()}.` : "",
    dutyLabel: result.student.classDuty ? CLASS_DUTY_LABELS[result.student.classDuty] : "",
  });
}
