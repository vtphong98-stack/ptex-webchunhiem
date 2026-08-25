import { getDb } from "@/lib/db";
import type { SyllClassInfo, SyllStudent } from "@/lib/excel-syll";
import { resolveClassConfig, resolveSchoolYear } from "@/lib/school-year-scope";
import { resolveSyllPassword } from "@/lib/syll-access";
import { normalizeDeskCount } from "@/lib/syll-seats";
import type { ClassConfig, Student } from "@/lib/types";

/** Tên trường in trên biểu mẫu khi GVCN chưa đổi trong phần cài đặt. */
const DEFAULT_SCHOOL_NAME = "TRƯỜNG THPT HUỲNH THỊ HƯỞNG";

const SYLL_CONFIG_FIELDS = {
  className: 1,
  fullName: 1,
  gvcnName: 1,
  gvcnDisplayName: 1,
  schoolName: 1,
  seatDeskCount: 1,
  syllPassword: 1,
  syllLocked: 1,
} as const;

/** Mọi cột hai sheet LyLich cần, cộng thêm phần xếp chỗ và trạng thái điền. */
const SYLL_PROJECTION = {
  fullName: 1,
  birthDay: 1,
  birthMonth: 1,
  birthYear: 1,
  birthPlace: 1,
  gender: 1,
  ethnicity: 1,
  policy: 1,
  addressGroup: 1,
  addressWard: 1,
  addressProvince: 1,
  fatherName: 1,
  fatherJob: 1,
  motherName: 1,
  motherJob: 1,
  contactPhone: 1,
  parentPhone: 1,
  conduct: 1,
  academic: 1,
  classRole: 1,
  email: 1,
  idNumber: 1,
  studentPhone: 1,
  weight: 1,
  height: 1,
  canSwim: 1,
  eyeDisease: 1,
  medicalHistory: 1,
  transport: 1,
  onlineLearning: 1,
  notes: 1,
  profileTt: 1,
  teamNumber: 1,
  teamRole: 1,
  classDuty: 1,
  seatDesk: 1,
  seatSide: 1,
  syllSubmittedAt: 1,
} as const;

export type SyllContext = {
  schoolYearId: string;
  yearName: string;
  isCurrent: boolean;
  info: SyllClassInfo;
  deskCount: number;
  /** Mật khẩu học sinh gõ để mở trang khai. */
  syllPassword: string;
  /** GVCN đã chốt sổ — không nhận khai mới, không cho sửa. */
  syllLocked: boolean;
};

export async function resolveSyllContext(yearName?: string | null): Promise<SyllContext | null> {
  const year = await resolveSchoolYear(yearName);
  if (!year?._id) return null;
  const schoolYearId = String(year._id);
  const config = (await resolveClassConfig(schoolYearId, { ...SYLL_CONFIG_FIELDS })) as ClassConfig | null;

  const className = config?.className?.trim() || "";

  return {
    schoolYearId,
    yearName: year.name,
    isCurrent: Boolean(year.isCurrent),
    deskCount: normalizeDeskCount(config?.seatDeskCount),
    syllPassword: resolveSyllPassword(config?.syllPassword, className),
    syllLocked: Boolean(config?.syllLocked),
    info: {
      schoolName: config?.schoolName?.trim() || DEFAULT_SCHOOL_NAME,
      className,
      yearName: year.name,
      gvcnName: config?.gvcnName?.trim() || "",
    },
  };
}

export type SyllRosterStudent = SyllStudent & { _id: string; syllSubmittedAt?: string };

/**
 * Danh sách lớp theo đúng thứ tự sổ gọi tên: số thứ tự GVCN đã nhập từ file
 * mẫu. Bản hướng dẫn nói rõ "tuyệt đối không được sai thứ tự học sinh", nên
 * mọi nơi đọc danh sách này đều phải sắp theo profileTt trước.
 */
export async function loadSyllStudents(schoolYearId: string): Promise<SyllRosterStudent[]> {
  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find({ schoolYearId }, { projection: SYLL_PROJECTION })
    .toArray();

  return students
    .map((student) => ({ ...student, _id: String(student._id) }) as SyllRosterStudent)
    .sort((a, b) => {
      const ttA = a.profileTt ?? Number.MAX_SAFE_INTEGER;
      const ttB = b.profileTt ?? Number.MAX_SAFE_INTEGER;
      if (ttA !== ttB) return ttA - ttB;
      return a.fullName.localeCompare(b.fullName, "vi");
    });
}

export function syllFilename(prefix: string, className: string) {
  const safe = (className || "Lop").replace(/[^\p{L}\p{N}]+/gu, "");
  return `${prefix}${safe}.xlsx`;
}

export function xlsxResponseHeaders(filename: string) {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store",
  };
}
