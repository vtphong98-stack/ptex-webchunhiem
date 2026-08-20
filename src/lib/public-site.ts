import { unstable_cache } from "next/cache";

import { parseMilestonesJson } from "@/lib/academic-calendar";
import { CLASS_SITE } from "@/lib/class-site";
import { parseStoredTimetable, timetableDisplayFromGrid, timetableDisplayFromJson } from "@/lib/excel-timetable";
import { getDb } from "@/lib/db";
import { getHomeBoard } from "@/lib/home-board";
import { sortNotices, toPublicNotice } from "@/lib/notices";
import type { ContactCard } from "@/lib/phone";
import { CLASS_CONFIG_FIELDS, resolveClassConfig, resolveSchoolYear } from "@/lib/school-year-scope";
import type { ClassTargets, GvcnNotice, Student } from "@/lib/types";

export const getPublicSiteData = unstable_cache(
  async () => {
    const year = await resolveSchoolYear(undefined, { seed: false });
    const schoolYearId = year?._id ? String(year._id) : "";
    const db = await getDb();

    const [students, config, noticeDocs, board] = schoolYearId
      ? await Promise.all([
          db
            .collection<Student>("students")
            .find({ schoolYearId }, { projection: { fullName: 1, birthDay: 1, birthMonth: 1 } })
            .sort({ profileTt: 1, fullName: 1 })
            .toArray(),
          resolveClassConfig(schoolYearId, {
            ...CLASS_CONFIG_FIELDS.identity,
            ...CLASS_CONFIG_FIELDS.timetable,
            ...CLASS_CONFIG_FIELDS.milestones,
          }),
          db
            .collection<GvcnNotice>("notices")
            .find({ schoolYearId }, { projection: { title: 1, body: 1, pinned: 1, createdByName: 1, createdAt: 1 } })
            .sort({ pinned: -1, createdAt: -1 })
            .limit(12)
            .toArray(),
          getHomeBoard(schoolYearId),
        ])
      : [[], null, [], await getHomeBoard("")];

    const stored = parseStoredTimetable(config?.timetableJson);
    const display = stored ? timetableDisplayFromGrid(stored) : { morning: {}, afternoon: {} };
    const timetableVersions = (config?.timetableHistory ?? [])
      .slice(0, 8)
      .map((item) => {
        const snapshot = timetableDisplayFromJson(item.timetableJson);
        if (!snapshot) return null;
        return { id: item.id, createdAt: item.createdAt, ...snapshot };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const notices = sortNotices(noticeDocs).slice(0, 8);
    const newest = [...noticeDocs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const newestId = newest?._id ? String(newest._id) : "";
    const milestones = parseMilestonesJson(config?.milestonesJson);

    // Danh tính lớp phải lấy từ classConfigs — chỗ mà trang setup ghi vào. Trước
    // đây hàm này đã tải config nhưng vẫn trả về hằng số trong class-site.ts,
    // nên đổi tên lớp ở phần setup không hiện ra bất kỳ đâu trên trang chủ.
    const yearName = year?.name ?? CLASS_SITE.schoolYear;
    const className = config?.className?.trim() || CLASS_SITE.className;
    const gvcnName = config?.gvcnName?.trim() || CLASS_SITE.gvcnName;

    return {
      className,
      fullName: config?.fullName?.trim() || `Lớp ${className} - ${yearName}`,
      schoolYear: yearName,
      yearName,
      gvcnName,
      gvcnDisplayName: config?.gvcnDisplayName?.trim() || `Thầy ${gvcnName}`,
      gvcnPhone: config?.gvcnPhone?.trim() || CLASS_SITE.gvcnPhone,
      gvcnZalo: config?.gvcnZalo?.trim() || config?.gvcnPhone?.trim() || CLASS_SITE.gvcnPhone,
      studentCount: students.length,
      students: students.map((s) => ({
        fullName: s.fullName,
        birthDay: s.birthDay ?? 0,
        birthMonth: s.birthMonth ?? 0,
      })),
      board,
      milestones,
      hasTimetable: Boolean(config?.timetableJson),
      timetableUpdatedAt: config?.timetableUpdatedAt || "",
      timetable: display,
      timetableVersions,
      notices: notices.map((n) => toPublicNotice(n, newestId)),
    };
  },
  ["public-site-data"],
  { revalidate: 60, tags: ["public-site", "notices", "timetable", "milestones"] },
);

/**
 * Danh tính lớp — tên lớp, tên GVCN, năm học — lấy từ classConfigs.
 *
 * Tách riêng khỏi getPublicSiteData để những trang chỉ cần cái tên (tiêu đề tab,
 * dòng đầu trang) không phải tải kèm học sinh, thông báo và bảng xếp hạng.
 */
export const getClassIdentity = unstable_cache(
  async () => {
    const year = await resolveSchoolYear(undefined, { seed: false });
    const schoolYearId = year?._id ? String(year._id) : "";
    const config = await resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.identity });
    const yearName = year?.name ?? CLASS_SITE.schoolYear;
    const className = config?.className?.trim() || CLASS_SITE.className;
    const gvcnName = config?.gvcnName?.trim() || CLASS_SITE.gvcnName;
    return {
      className,
      fullName: config?.fullName?.trim() || `Lớp ${className} - ${yearName}`,
      schoolYear: yearName,
      gvcnName,
      gvcnDisplayName: config?.gvcnDisplayName?.trim() || `Thầy ${gvcnName}`,
      gvcnPhone: config?.gvcnPhone?.trim() || CLASS_SITE.gvcnPhone,
      gvcnZalo: config?.gvcnZalo?.trim() || config?.gvcnPhone?.trim() || CLASS_SITE.gvcnPhone,
    };
  },
  ["class-identity"],
  { revalidate: 60, tags: ["public-site", "class-identity"] },
);

export const getBothContactDirectories = unstable_cache(
  async () => {
    const year = await resolveSchoolYear(undefined, { seed: false });
    const schoolYearId = year?._id ? String(year._id) : "";
    if (!schoolYearId) {
      return { yearName: "", parents: [] as ContactCard[], students: [] as ContactCard[] };
    }

    const db = await getDb();
    const rawStudents = await db
      .collection<Student>("students")
      .find(
        { schoolYearId },
        {
          projection: {
            fullName: 1,
            parentName: 1,
            fatherName: 1,
            motherName: 1,
            parentPhone: 1,
            contactPhone: 1,
            studentPhone: 1,
            classRole: 1,
            position: 1,
          },
        },
      )
      .sort({ profileTt: 1, fullName: 1 })
      .toArray();

    const parents: ContactCard[] = [];
    const students: ContactCard[] = [];

    for (const s of rawStudents) {
      const parentNotes = [s.fatherName && `Cha: ${s.fatherName}`, s.motherName && `Mẹ: ${s.motherName}`]
        .filter(Boolean)
        .join(" · ");

      parents.push({
        id: String(s._id),
        fullName: s.fullName,
        subtitle: parentNotes || s.parentName || "",
        phone: s.contactPhone || s.parentPhone || "",
      });

      students.push({
        id: String(s._id),
        fullName: s.fullName,
        subtitle: s.classRole || s.position || "",
        phone: s.studentPhone || "",
      });
    }

    return { yearName: year?.name ?? "", parents, students };
  },
  ["both-contact-directories"],
  { revalidate: 60, tags: ["contacts", "students"] },
);

export const getTeacherTimetableServer = unstable_cache(
  async () => {
    const year = await resolveSchoolYear(undefined, { seed: false });
    const schoolYearId = year?._id ? String(year._id) : "";
    const config = await resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.teacherTimetable });
    const raw = (config as Record<string, unknown>)?.teacherTimetableJson as string | undefined;
    return {
      data: raw ? JSON.parse(raw) : null,
      updatedAt: (config as Record<string, unknown>)?.teacherTimetableUpdatedAt || "",
    };
  },
  ["teacher-timetable-server"],
  { revalidate: 60, tags: ["timetable", "teacher-timetable"] },
);

export const getTeachingPlanServer = unstable_cache(
  async () => {
    const year = await resolveSchoolYear(undefined, { seed: false });
    const schoolYearId = year?._id ? String(year._id) : "";
    const config = await resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.teachingPlan });
    const raw = (config as Record<string, unknown>)?.teachingPlanJson as string | undefined;
    return {
      data: raw ? JSON.parse(raw) : null,
      updatedAt: (config as Record<string, unknown>)?.teachingPlanUpdatedAt || "",
    };
  },
  ["teaching-plan-server"],
  { revalidate: 60, tags: ["teaching-plan"] },
);

export const getTargetsServer = unstable_cache(
  async () => {
    const year = await resolveSchoolYear(undefined, { seed: false });
    const schoolYearId = year?._id ? String(year._id) : "";
    const config = await resolveClassConfig(schoolYearId, { ...CLASS_CONFIG_FIELDS.targets });
    const raw = (config as Record<string, unknown>)?.targetsJson as string | undefined;
    return {
      data: raw ? (JSON.parse(raw) as ClassTargets) : null,
      updatedAt: ((config as Record<string, unknown>)?.targetsUpdatedAt as string) || "",
    };
  },
  ["targets-server-data"],
  { revalidate: 60, tags: ["targets", "class-targets"] },
);

export async function getContactDirectory(kind: "parents" | "students") {
  const both = await getBothContactDirectories();
  return { yearName: both.yearName, items: kind === "parents" ? both.parents : both.students };
}
