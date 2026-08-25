import { getDb } from "@/lib/db";
import { getSeedUsers } from "@/lib/seed-users";
import {
  CLASS_DUTY_LABELS,
  CLASS_DUTY_USERNAME,
  TEAM_ROLE_LABELS,
  studentPositionLabel,
  teamRoleUsername,
} from "@/lib/team-roster";
import type { ClassDuty, Student, TeamRole, UserAccount } from "@/lib/types";

/**
 * Một nơi duy nhất thay đổi chức vụ.
 *
 * Chức vụ dính tới ba thứ: hồ sơ học sinh, tài khoản đăng nhập của chức vụ đó,
 * và cái tên hiện trên sơ đồ lớp. Trước đây mỗi màn hình tự sửa một kiểu — nhập
 * Excel chia tổ thì có đồng bộ tên tài khoản, xếp chỗ ngồi thì không — nên tài
 * khoản "lpht" vẫn mang tên em đã thôi chức. Mọi đường sửa chức vụ giờ đi qua
 * đây.
 */

export const SEAT_TEAM_NUMBERS = [1, 2, 3, 4] as const;

export type DutyChange = {
  teamNumber?: number | null;
  teamRole?: TeamRole | null;
  classDuty?: ClassDuty | null;
  seatDesk?: number | null;
  seatSide?: "trong" | "ngoai" | null;
};

export type DutyView = {
  _id: string;
  teamNumber: number | null;
  teamRole: TeamRole | null;
  classDuty: ClassDuty | null;
  seatDesk: number | null;
  seatSide: "trong" | "ngoai" | null;
  position: string;
};

function toDutyView(student: Pick<Student, "_id" | "teamNumber" | "teamRole" | "classDuty" | "seatDesk" | "seatSide">): DutyView {
  const view = {
    teamNumber: student.teamNumber ?? null,
    teamRole: student.teamRole ?? null,
    classDuty: student.classDuty ?? null,
    seatDesk: student.seatDesk ?? null,
    seatSide: student.seatSide ?? null,
  };
  return { _id: String(student._id), ...view, position: studentPositionLabel({ ...view, position: null }) };
}

/** Tên mặc định của tài khoản chức vụ khi chưa ai giữ chức đó. */
function defaultAccountNames() {
  const names = new Map<string, string>();
  for (const account of getSeedUsers()) names.set(account.username, account.fullName);
  for (const team of SEAT_TEAM_NUMBERS) {
    names.set(`tt${team}`, `Tổ trưởng tổ ${team}`);
    names.set(`tp${team}`, `Tổ phó tổ ${team}`);
  }
  return names;
}

/**
 * Đẩy tên học sinh vào tài khoản đăng nhập của chức vụ, để em đăng nhập đúng
 * chức vụ là thấy tên mình chứ không phải chữ "Lớp phó học tập".
 *
 * Tính lại toàn bộ từ danh sách lớp thay vì sửa lẻ từng tài khoản: bỏ chức của
 * một em cũng phải trả tài khoản về tên mặc định, sửa lẻ thì bước đó luôn bị bỏ
 * quên.
 */
export async function syncDutyAccounts(schoolYearId: string) {
  if (!schoolYearId) return;
  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find({ schoolYearId }, { projection: { fullName: 1, teamNumber: 1, teamRole: 1, classDuty: 1 } })
    .toArray();

  const holders = new Map<string, string>();
  for (const student of students) {
    if (student.classDuty && !holders.has(CLASS_DUTY_USERNAME[student.classDuty])) {
      holders.set(CLASS_DUTY_USERNAME[student.classDuty], student.fullName);
    }
    const teamAccount = teamRoleUsername(student.teamRole ?? null, student.teamNumber ?? null);
    if (teamAccount && !holders.has(teamAccount)) holders.set(teamAccount, student.fullName);
  }

  const now = new Date().toISOString();
  const defaults = defaultAccountNames();
  const operations = [...defaults].map(([username, fallback]) => ({
    updateOne: {
      filter: { username } as never,
      update: { $set: { fullName: holders.get(username) ?? fallback, updatedAt: now } },
    },
  }));
  if (operations.length) {
    await db.collection<UserAccount>("users").bulkWrite(operations, { ordered: false });
  }
}

export type DutyConflict = { label: string; holderName: string };

/**
 * Ai đang giữ chức vụ mà một em định nhận.
 *
 * Bên GVCN, giao chức cho em này là hạ chức em kia — thầy cô biết mình đang làm
 * gì. Còn form học sinh tự khai thì không được phép: một em gõ nhầm "Lớp
 * trưởng" là mất chức của bạn khác mà không ai hay. Nên đường đó hỏi hàm này
 * trước rồi báo lỗi.
 */
export async function findDutyConflict(
  schoolYearId: string,
  studentId: string,
  duty: { classDuty?: ClassDuty | null; teamRole?: TeamRole | null; teamNumber?: number | null },
): Promise<DutyConflict | null> {
  const db = await getDb();
  const students = db.collection<Student>("students");

  if (duty.classDuty) {
    const holder = await students.findOne(
      { schoolYearId, classDuty: duty.classDuty, _id: { $ne: studentId } },
      { projection: { fullName: 1 } },
    );
    if (holder) return { label: CLASS_DUTY_LABELS[duty.classDuty], holderName: holder.fullName };
  }

  if (duty.teamNumber && (duty.teamRole === "toTruong" || duty.teamRole === "toPho")) {
    const holder = await students.findOne(
      { schoolYearId, teamNumber: duty.teamNumber, teamRole: duty.teamRole, _id: { $ne: studentId } },
      { projection: { fullName: 1 } },
    );
    if (holder) {
      return {
        label: `${TEAM_ROLE_LABELS[duty.teamRole]} tổ ${duty.teamNumber}`,
        holderName: holder.fullName,
      };
    }
  }

  return null;
}

/**
 * Đổi tổ / chức vụ / chỗ ngồi cho một em, giữ nguyên các ràng buộc: mỗi tổ chỉ
 * một tổ trưởng và một tổ phó, mỗi chức vụ lớp chỉ một em. Ai bị đụng chức thì
 * được hạ xuống và trả về trong `peers` để màn hình cập nhật ngay.
 */
export async function applyDutyChange(student: Student, change: DutyChange) {
  const db = await getDb();
  const students = db.collection<Student>("students");
  const id = String(student._id);
  const now = new Date().toISOString();

  const teamNumber = change.teamNumber === undefined ? student.teamNumber ?? null : change.teamNumber;
  const classDuty = change.classDuty === undefined ? student.classDuty ?? null : change.classDuty;
  const movedTeam = teamNumber !== (student.teamNumber ?? null);
  // Tổ trưởng gắn với một tổ cụ thể; chuyển sang tổ khác thì không mang chức
  // theo, vì tổ mới đã có tổ trưởng của họ. Chức vụ lớp thì không dính tổ nào.
  const teamRole =
    change.teamRole !== undefined
      ? change.teamRole
      : movedTeam
        ? teamNumber
          ? "thanhVien"
          : null
        : student.teamRole ?? null;

  const demoted = new Set<string>();

  for (const role of ["toTruong", "toPho"] as const) {
    if (!teamNumber || teamRole !== role) continue;
    const peers = await students
      .find({ schoolYearId: student.schoolYearId, teamNumber, teamRole: role, _id: { $ne: id } })
      .project({ _id: 1 })
      .toArray();
    if (!peers.length) continue;
    for (const peer of peers) demoted.add(String(peer._id));
    await students.updateMany(
      { schoolYearId: student.schoolYearId, teamNumber, teamRole: role, _id: { $ne: id } },
      { $set: { teamRole: "thanhVien", updatedAt: now } },
    );
  }

  if (classDuty) {
    const peers = await students
      .find({ schoolYearId: student.schoolYearId, classDuty, _id: { $ne: id } })
      .project({ _id: 1 })
      .toArray();
    for (const peer of peers) demoted.add(String(peer._id));
    if (peers.length) {
      await students.updateMany(
        { schoolYearId: student.schoolYearId, classDuty, _id: { $ne: id } },
        { $set: { classDuty: null, updatedAt: now } },
      );
    }
  }

  const seatDesk = change.seatDesk === undefined ? student.seatDesk ?? null : change.seatDesk;
  const seatSide = change.seatSide === undefined ? student.seatSide ?? null : change.seatSide;
  const payload = {
    teamNumber,
    teamRole,
    classDuty,
    seatDesk,
    seatSide,
    position: studentPositionLabel({ teamNumber, teamRole, classDuty, position: null }),
    updatedAt: now,
  };
  await students.updateOne({ _id: id }, { $set: payload });

  // Nhãn chức vụ của những em bị hạ chức cũng phải tính lại, nếu không danh sách
  // vẫn hiện "Tổ trưởng tổ 2" cho em vừa mất chức.
  const peerDocs = demoted.size
    ? await students
        .find(
          { _id: { $in: [...demoted] } },
          { projection: { teamNumber: 1, teamRole: 1, classDuty: 1, seatDesk: 1, seatSide: 1 } },
        )
        .toArray()
    : [];
  for (const peer of peerDocs) {
    await students.updateOne(
      { _id: peer._id },
      {
        $set: {
          position: studentPositionLabel({
            teamNumber: peer.teamNumber ?? null,
            teamRole: peer.teamRole ?? null,
            classDuty: peer.classDuty ?? null,
            position: null,
          }),
          updatedAt: now,
        },
      },
    );
  }

  await syncDutyAccounts(student.schoolYearId);

  return {
    student: toDutyView({ _id: id, ...payload }),
    peers: peerDocs.map((peer) => toDutyView(peer)),
  };
}
