import { emptyTimetableGrid, parseStoredTimetable, timetableDisplayFromGrid } from "@/lib/excel-timetable";
import { getDb } from "@/lib/db";
import type { ContactCard } from "@/lib/phone";
import { resolveClassConfig, resolveSchoolYear } from "@/lib/school-year-scope";
import type { Student } from "@/lib/types";

export async function getPublicSiteData() {
  const year = await resolveSchoolYear();
  const schoolYearId = year?._id ? String(year._id) : "";
  const db = await getDb();
  const students = schoolYearId
    ? await db
        .collection<Student>("students")
        .find({ schoolYearId }, { projection: { fullName: 1, birthDay: 1, birthMonth: 1 } })
        .sort({ profileTt: 1, fullName: 1 })
        .toArray()
    : [];
  const config = schoolYearId ? await resolveClassConfig(schoolYearId) : null;
  const stored = parseStoredTimetable(config?.timetableJson);
  const display = timetableDisplayFromGrid(stored ?? emptyTimetableGrid());

  return {
    yearName: year?.name ?? "2026-2027",
    hasTimetable: Boolean(stored),
    students: students.map((item) => ({
      fullName: item.fullName,
      birthDay: item.birthDay,
      birthMonth: item.birthMonth,
    })),
    timetable: display,
  };
}

export async function getContactDirectory(kind: "parents" | "students") {
  const year = await resolveSchoolYear();
  const schoolYearId = year?._id ? String(year._id) : "";
  if (!schoolYearId) return { yearName: year?.name ?? "", items: [] as ContactCard[] };

  const db = await getDb();
  const students = await db
    .collection<Student>("students")
    .find({ schoolYearId })
    .sort({ profileTt: 1, fullName: 1 })
    .toArray();

  const items = students.map((student) => {
    if (kind === "students") {
      return {
        id: String(student._id),
        fullName: student.fullName,
        subtitle: student.classRole || student.position || "",
        phone: student.studentPhone || "",
      };
    }
    const parents = [student.fatherName && `Cha: ${student.fatherName}`, student.motherName && `Mẹ: ${student.motherName}`]
      .filter(Boolean)
      .join(" · ");
    return {
      id: String(student._id),
      fullName: student.fullName,
      subtitle: parents || student.parentName || "",
      phone: student.contactPhone || student.parentPhone || "",
    };
  });

  return { yearName: year?.name ?? "", items };
}
