import Link from "next/link";

import { requireGvcn } from "@/lib/access";
import { getDb } from "@/lib/db";
import { resolveSchoolYear } from "@/lib/school-year-scope";
import { sortTeamStudents, studentPositionLabel } from "@/lib/team-roster";
import type { Student } from "@/lib/types";
import { StudentLookupPublic } from "@/components/public/StudentLookupPublic";
import { getClassIdentity } from "@/lib/public-site";

export const revalidate = 60;

export async function generateMetadata() {
  const site = await getClassIdentity();
  return {
    title: `Tra cứu học sinh · ${site.fullName}`,
    description: `Tra cứu thông tin học sinh lớp ${site.className}`,
  };
}

export default async function TraCuuPage() {
  const site = await getClassIdentity();
  await requireGvcn("/tra-cuu-hs");

  const year = await resolveSchoolYear();
  const schoolYearId = year?._id ? String(year._id) : "";

  let students: Array<{
    id: string;
    fullName: string;
    birthDay: number;
    birthMonth: number;
    birthYear: number | null;
    teamNumber: number | null;
    position: string;
    gender: string;
    ethnicity: string;
    birthPlace: string;
    idNumber: string;
    addressGroup: string;
    addressWard: string;
    addressProvince: string;
    fatherName: string;
    fatherJob: string;
    motherName: string;
    motherJob: string;
    parentPhone: string;
    contactPhone: string;
    motherPhone: string;
    studentPhone: string;
    email: string;
    classRole: string;
    notes: string;
  }> = [];

  if (schoolYearId) {
    const db = await getDb();
    const raw = await db
      .collection<Student>("students")
      .find({ schoolYearId })
      .sort({ profileTt: 1, fullName: 1 })
      .toArray();

    students = sortTeamStudents(raw).map((s) => ({
      id: String(s._id),
      fullName: s.fullName,
      birthDay: s.birthDay,
      birthMonth: s.birthMonth,
      birthYear: s.birthYear ?? null,
      teamNumber: s.teamNumber ?? null,
      position: studentPositionLabel(s),
      gender: s.gender || "",
      ethnicity: s.ethnicity || "",
      birthPlace: s.birthPlace || "",
      idNumber: s.idNumber || "",
      addressGroup: s.addressGroup || "",
      addressWard: s.addressWard || "",
      addressProvince: s.addressProvince || "",
      fatherName: s.fatherName || "",
      fatherJob: s.fatherJob || "",
      motherName: s.motherName || "",
      motherJob: s.motherJob || "",
      parentPhone: s.contactPhone || s.parentPhone || "",
      contactPhone: s.contactPhone || s.parentPhone || "",
      motherPhone: s.motherPhone || "",
      studentPhone: s.studentPhone || "",
      email: s.email || "",
      classRole: s.classRole || "",
      notes: s.notes || "",
    }));
  }

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <p className="mb-3"><Link href="/" className="text-sm text-indigo-600 hover:underline">← Trang chủ</Link></p>
        <section className="site-section block-teal">
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>🔍 Tra Cứu Học Sinh</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            {site.fullName} · GVCN {site.gvcnDisplayName}
          </p>
          <StudentLookupPublic students={students} />
        </section>
      </div>
    </main>
  );
}
