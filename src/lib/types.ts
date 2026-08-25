export const APP_ROLES = [
  "admin",
  "gvcn",
  "lopTruong",
  "lopPhoHocTap",
  "lopPhoLaoDong",
  "lopPhoPhongTrao",
  "lopPhoTratTu",
  "toTruong",
  "toPho",
  "thuQuy",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type NavView =
  | "overview"
  | "students"
  | "parents"
  | "reports"
  | "school-years"
  | "accounts"
  | "audit";

export type SchoolWeek = {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  dateRangeLabel?: string;
};

export type SchoolYear = {
  _id?: string;
  name: string;
  label: string;
  startDate: string;
  endDate: string;
  weekCount: number;
  weeks: SchoolWeek[];
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassConfig = {
  _id?: string;
  schoolYearId: string;
  className: string;
  fullName: string;
  /** Tên trường in ở góc trái biểu mẫu sơ yếu lý lịch. */
  schoolName?: string;
  /** Số bàn mỗi tổ trong sơ đồ chỗ ngồi (mặc định 6). */
  seatDeskCount?: number;
  gvcnName: string;
  gvcnDisplayName: string;
  gvcnPhone: string;
  gvcnZalo: string;
  examTitle?: string;
  examDate?: string;
  note?: string;
  timetableJson?: string;
  timetableUpdatedAt?: string;
  timetableHistory?: TimetableVersion[];
  teacherTimetableJson?: string;
  teacherTimetableUpdatedAt?: string;
  teachingPlanJson?: string;
  teachingPlanUpdatedAt?: string;
  targetsJson?: string;
  targetsUpdatedAt?: string;
  milestonesJson?: string;
  milestonesUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TargetMetric = { count: number; percent: number };

// 4 mức (Rèn luyện hoặc Bộ môn): Tốt, Khá, Đạt, Chưa đạt (không có Xuất sắc)
export type FourLevelMetric = {
  tot: TargetMetric;
  kha: TargetMetric;
  dat: TargetMetric;
  chuaDat: TargetMetric;
};

// 5 mức (Học lực cả năm lớp chủ nhiệm): 4 mức cơ bản (Tốt, Khá, Đạt, Chưa đạt) + Xuất sắc xét riêng trên toàn lớp
export type HomeroomAcademicMetric = {
  tot: TargetMetric;      // Tốt / Giỏi (Mức học lực cơ bản)
  kha: TargetMetric;      // Khá (Mức học lực cơ bản)
  dat: TargetMetric;      // Đạt (Mức học lực cơ bản)
  chuaDat: TargetMetric;  // Chưa đạt (Mức học lực cơ bản)
  xuatSac: TargetMetric;  // Danh hiệu Học sinh Xuất sắc (Xét riêng, % tính trên toàn bộ sĩ số lớp)
  gioi?: TargetMetric;    // Alias backward compat
};

// Từng lớp bộ môn Toán (mức cao nhất là Tốt)
export type SubjectClassTarget = {
  id: string;
  className: string;
  totalStudents: number;
  subject?: string;
  tot: TargetMetric;
  kha: TargetMetric;
  dat: TargetMetric;
  chuaDat: TargetMetric;
};

export type ClassTargets = {
  schoolYear: string;

  // 1. PHẦN CHỦ NHIỆM (Lớp chủ nhiệm)
  homeroom: {
    className: string;
    totalStudents: number;
    conduct: FourLevelMetric;          // Rèn luyện: Tốt, Khá, Đạt, Chưa đạt (không có Xuất sắc)
    academic: HomeroomAcademicMetric; // Học tập: 4 mức cơ bản (100%) + Xuất sắc xét riêng (% tính trên toàn lớp)
  };

  // 2. PHẦN BỘ MÔN (Giảng dạy môn Toán theo từng lớp)
  subjectTeaching: {
    subjectName: string;
    classes: SubjectClassTarget[];     // Từng lớp: Tốt, Khá, Đạt, Chưa đạt
  };

  // 3. DANH HIỆU & PHONG TRÀO
  otherTargets: {
    hocSinhGioi?: string;
    totNghiepThpt?: string;
    daiHocCaoDang?: string;
    danhHieuLop?: string;
    phongTrao?: string;
    ghiChu?: string;
  };

  updatedAt?: string;
};

/**
 * Actual results the teacher types in per semester, to sit beside the targets.
 * The app has no grade book, so the conduct/academic counts cannot be derived —
 * they come from the school's own system and are recorded here for comparison.
 */
export type SemesterActual = {
  totalStudents: number;
  conduct: { tot: number; kha: number; dat: number; chuaDat: number };
  academic: { tot: number; kha: number; dat: number; chuaDat: number; xuatSac: number };
  note?: string;
};

export type ClassTargetsActual = {
  hk1: SemesterActual;
  hk2: SemesterActual;
  updatedAt?: string;
};

export type TimetableVersion = {
  id: string;
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
  timetableJson: string;
};

export type GvcnNotice = {
  _id?: string;
  schoolYearId: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
};

export const TEAM_ROLES = ["toTruong", "toPho", "thanhVien"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const CLASS_DUTIES = [
  "lopTruong",
  "lopPhoHocTap",
  "lopPhoLaoDong",
  "lopPhoPhongTrao",
  "lopPhoTratTu",
  "thuQuy",
] as const;
export type ClassDuty = (typeof CLASS_DUTIES)[number];

export type ReportWriteMode = "create" | "append" | "edit";

export type Student = {
  _id?: string;
  schoolYearId: string;
  fullName: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  teamNumber: number | null;
  teamRole: TeamRole | null;
  classDuty: ClassDuty | null;
  position: string | null;
  parentPhone: string;
  parentName: string;
  studentPhone?: string;
  email?: string;
  idNumber?: string;
  birthPlace?: string;
  gender?: string;
  ethnicity?: string;
  policy?: string;
  addressGroup?: string;
  addressWard?: string;
  addressProvince?: string;
  fatherName?: string;
  fatherJob?: string;
  motherName?: string;
  motherJob?: string;
  contactPhone?: string;
  classRole?: string;
  conduct?: string;
  academic?: string;
  weight?: string;
  height?: string;
  canSwim?: string;
  eyeDisease?: string;
  medicalHistory?: string;
  transport?: string;
  onlineLearning?: string;
  profileTt?: number;
  /** Bàn thứ mấy trong tổ (1 là bàn đầu). Cặp với seatSide thành một chỗ ngồi. */
  seatDesk?: number | null;
  /** Chỗ sát lối đi ("ngoai") hay chỗ bên trong ("trong"). */
  seatSide?: "trong" | "ngoai" | null;
  /** Lúc học sinh gửi sơ yếu lý lịch — trống nghĩa là chưa điền. */
  syllSubmittedAt?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ParentContact = {
  _id?: string;
  schoolYearId: string;
  studentId: string | null;
  studentName: string;
  parentName: string;
  relationship: string;
  phone: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type UserAccount = {
  _id?: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: AppRole;
  teamNumber: number | null;
  schoolYearScope: "all" | "current";
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyReport = {
  _id?: string;
  schoolYearId: string;
  weekNumber: number;
  weekLabel: string;
  reporterRole: AppRole;
  reporterName: string;
  teamNumber: number | null;
  summary: string;
  studyNotes: string;
  disciplineNotes: string;
  activityNotes: string;
  financeNotes: string;
  futurePlan: string;
  fields?: Record<string, string>;
  source?: "form" | "xlsx";
  status: "draft" | "submitted" | "reviewed";
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  _id?: string;
  schoolYearId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  actorId: string;
  actorName: string;
  actorRole: AppRole;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: AppRole;
  teamNumber: number | null;
  schoolYearScope: "all" | "current";
};

export type LegacySeedData = {
  classInfo: {
    className: string;
    schoolYear: string;
    fullName: string;
  };
  gvcnInfo: {
    name: string;
    displayName: string;
    phone: string;
    zalo: string;
  };
  examInfo: {
    hk1Title?: string;
    hk1DateFull?: string;
  };
  students: Array<{
    name: string;
    birthDay: number;
    birthMonth: number;
  }>;
  parents: Array<{
    id?: number;
    name: string;
    phone: string;
  }>;
};
