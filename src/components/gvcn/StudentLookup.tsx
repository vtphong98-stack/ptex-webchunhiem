"use client";

import { useEffect, useMemo, useState } from "react";

import { telHref, zaloHref } from "@/lib/phone";
import { formatBirthDate } from "@/lib/team-roster";

type LookupStudent = {
  _id: string;
  fullName: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  teamNumber: number | null;
  position: string;
  parentPhone: string;
  parentName: string;
  studentPhone?: string;
  contactPhone?: string;
  motherPhone?: string;
  email?: string;
  idNumber?: string;
  birthPlace?: string;
  gender?: string;
  ethnicity?: string;
  addressGroup?: string;
  addressWard?: string;
  addressProvince?: string;
  fatherName?: string;
  fatherJob?: string;
  motherName?: string;
  motherJob?: string;
  classRole?: string;
  notes: string;
};

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="text-slate-500">{label}: </span>
      <strong>{value}</strong>
    </p>
  );
}

export function StudentLookup({ yearName }: { yearName: string }) {
  const [students, setStudents] = useState<LookupStudent[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const qs = yearName ? `?year=${encodeURIComponent(yearName)}&profile=1` : "?profile=1";
    fetch(`/api/gvcn/students${qs}`)
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        setStudents(data?.students ?? []);
        setError("");
      })
      .catch(() => setError("Chưa tải được danh sách học sinh."));
  }, [yearName]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [
        student.fullName,
        student.idNumber,
        student.fatherName,
        student.motherName,
        student.contactPhone,
        student.parentPhone,
        student.motherPhone,
        student.studentPhone,
        student.addressWard,
        student.addressGroup,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, students]);

  const selected = students.find((student) => student._id === selectedId) ?? filtered[0] ?? null;
  const parentPhone = selected?.contactPhone || selected?.parentPhone || "";
  const studentPhone = selected?.studentPhone || "";
  const address = [selected?.addressGroup, selected?.addressWard, selected?.addressProvince].filter(Boolean).join(", ");

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Tra cứu học sinh</h2>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tên, SĐT, CCCD, phụ huynh…"
          value={query}
        />
        {error ? <p className="mt-2 text-sm text-amber-700">{error}</p> : null}
        <ul className="mt-3 max-h-[300px] space-y-1 overflow-auto lg:max-h-[70vh]">
          {filtered.map((student) => (
            <li key={student._id}>
              <button
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  selected?._id === student._id ? "bg-blue-50 font-semibold text-blue-700" : "hover:bg-slate-50"
                }`}
                onClick={() => setSelectedId(student._id)}
                type="button"
              >
                {student.fullName}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  {student.teamNumber ? `Tổ ${student.teamNumber}` : "Chưa gán tổ"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4 sm:p-5">
        {!selected ? (
          <p className="text-sm text-slate-500">Chưa có học sinh trong năm này. Em điền sơ yếu lý lịch để tạo hồ sơ.</p>
        ) : (
          <>
            <h3 className="text-xl font-bold">{selected.fullName}</h3>
            <p className="mb-4 text-sm text-slate-500">
              {formatBirthDate(selected) || "Chưa có ngày sinh"}
              {selected.position ? ` · ${selected.position}` : ""}
              {selected.classRole ? ` · ${selected.classRole}` : ""}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Row label="Giới tính" value={selected.gender} />
              <Row label="Dân tộc" value={selected.ethnicity} />
              <Row label="Nơi sinh" value={selected.birthPlace} />
              <Row label="CCCD" value={selected.idNumber} />
              <Row label="Nơi ở" value={address} />
              <Row label="Cha" value={[selected.fatherName, selected.fatherJob].filter(Boolean).join(" · ")} />
              <Row label="Mẹ" value={[selected.motherName, selected.motherJob].filter(Boolean).join(" · ")} />
              <Row label="SĐT phụ huynh" value={parentPhone} />
              <Row label="SĐT của mẹ" value={selected?.motherPhone} />
              <Row label="SĐT học sinh" value={studentPhone} />
              <Row label="Email" value={selected.email} />
              <Row label="Ghi chú" value={selected.notes} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {parentPhone ? (
                <>
                  <a className="button-primary" href={telHref(parentPhone)}>
                    Gọi phụ huynh
                  </a>
                  <a className="button-secondary" href={zaloHref(parentPhone)} rel="noreferrer" target="_blank">
                    Zalo phụ huynh
                  </a>
                </>
              ) : null}
              {studentPhone ? (
                <>
                  <a className="button-primary" href={telHref(studentPhone)}>
                    Gọi học sinh
                  </a>
                  <a className="button-secondary" href={zaloHref(studentPhone)} rel="noreferrer" target="_blank">
                    Zalo học sinh
                  </a>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
