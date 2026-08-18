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
  gvcnName: string;
  gvcnDisplayName: string;
  gvcnPhone: string;
  gvcnZalo: string;
  examTitle?: string;
  examDate?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type Student = {
  _id?: string;
  schoolYearId: string;
  fullName: string;
  birthDay: number;
  birthMonth: number;
  teamNumber: number | null;
  position: string | null;
  parentPhone: string;
  parentName: string;
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
