"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CLASS_DUTY_LABELS,
  TEAM_ROLE_LABELS,
  classDutyOptions,
  formatBirthDate,
  studentPositionLabel,
} from "@/lib/team-roster";
import type { ClassDuty, TeamRole } from "@/lib/types";

type DeskStudent = {
  _id: string;
  fullName: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number | null;
  teamNumber: number | null;
  teamRole: TeamRole | null;
  classDuty: ClassDuty | null;
  position: string;
  notes: string;
  violationCount: number;
  absentDays: number;
};

type PatchBody = {
  teamNumber?: number | null;
  teamRole?: TeamRole | null;
  classDuty?: ClassDuty | null;
};

function applyPatchLocal(list: DeskStudent[], id: string, body: PatchBody): DeskStudent[] {
  const target = list.find((student) => student._id === id);
  if (!target) return list;

  const nextTeam = body.teamNumber !== undefined ? body.teamNumber : target.teamNumber;
  let nextRole = body.teamRole !== undefined ? body.teamRole : target.teamRole;
  const nextDuty = body.classDuty !== undefined ? body.classDuty : target.classDuty;

  if (body.teamNumber !== undefined && body.teamNumber !== target.teamNumber && body.teamRole === undefined) {
    nextRole = "thanhVien";
  }

  return list.map((student) => {
    if (student._id === id) {
      return {
        ...student,
        teamNumber: nextTeam,
        teamRole: nextRole,
        classDuty: nextDuty,
        position: studentPositionLabel({ teamRole: nextRole, classDuty: nextDuty, position: null }),
      };
    }
    if (nextTeam && nextRole === "toTruong" && student.teamNumber === nextTeam && student.teamRole === "toTruong") {
      return {
        ...student,
        teamRole: "thanhVien",
        position: studentPositionLabel({ teamRole: "thanhVien", classDuty: student.classDuty, position: null }),
      };
    }
    if (nextTeam && nextRole === "toPho" && student.teamNumber === nextTeam && student.teamRole === "toPho") {
      return {
        ...student,
        teamRole: "thanhVien",
        position: studentPositionLabel({ teamRole: "thanhVien", classDuty: student.classDuty, position: null }),
      };
    }
    if (nextDuty && student.classDuty === nextDuty) {
      return {
        ...student,
        classDuty: null,
        position: studentPositionLabel({ teamRole: student.teamRole, classDuty: null, position: null }),
      };
    }
    return student;
  });
}

export function TeamManager({ readOnly = false, yearName = "" }: { readOnly?: boolean; yearName?: string }) {
  const [students, setStudents] = useState<DeskStudent[]>([]);
  const [message, setMessage] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const studentsRef = useRef(students);
  studentsRef.current = students;

  const load = useCallback(async () => {
    const qs = yearName ? `?lite=1&year=${encodeURIComponent(yearName)}` : "?lite=1";
    const response = await fetch(`/api/gvcn/students${qs}`);
    if (!response.ok) {
      setMessage("Chưa tải được danh sách tổ.");
      return;
    }
    const data = await response.json();
    setStudents(data.students ?? []);
  }, [yearName]);

  useEffect(() => {
    load().catch(() => setMessage("Chưa tải được danh sách tổ."));
  }, [load, yearName]);

  const teams = useMemo(() => {
    return [1, 2, 3, 4].map((teamNumber) => ({
      teamNumber,
      members: students.filter((student) => student.teamNumber === teamNumber),
    }));
  }, [students]);
  const unassigned = students.filter((student) => !student.teamNumber);

  function patchStudent(id: string, body: PatchBody) {
    const snapshot = studentsRef.current;
    setStudents((current) => applyPatchLocal(current, id, body));
    setMessage("");
    setPendingIds((current) => new Set(current).add(id));

    void fetch(`/api/gvcn/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("patch failed");
        const data = await response.json();
        if (data.student || data.peers?.length) {
          setStudents((current) => {
            let next = current;
            if (data.student) {
              next = next.map((student) =>
                student._id === data.student._id ? { ...student, ...data.student } : student,
              );
            }
            for (const peer of data.peers ?? []) {
              next = next.map((student) =>
                student._id === peer._id ? { ...student, ...peer } : student,
              );
            }
            return next;
          });
        }
      })
      .catch(() => {
        setStudents(snapshot);
        setMessage("Không lưu được thay đổi — đã hoàn tác.");
      })
      .finally(() => {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      });
  }

  async function removeStudent(id: string, fullName: string) {
    if (!window.confirm(`Xóa ${fullName} khỏi danh sách lớp?`)) return;
    const snapshot = studentsRef.current;
    setStudents((current) => current.filter((student) => student._id !== id));
    const response = await fetch(`/api/gvcn/students/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setStudents(snapshot);
      setMessage("Không xóa được học sinh.");
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setImportBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/gvcn/students/import", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setImportBusy(false);
    if (!response.ok) {
      setMessage(data.error || "Import Excel thất bại.");
      return;
    }
    setMessage(`Đã nhận Excel: thêm ${data.created}, cập nhật ${data.updated}.`);
    await load();
  }

  return (
    <section className="space-y-4">
      <div className="card p-5">
        <h2 className="text-lg font-semibold">Phân tổ bằng Excel</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {readOnly
            ? "Năm cũ chỉ xem phân công. Chuyển sang năm hiện hành để bổ nhiệm ban cán sự."
            : "Tải mẫu 4 tổ, gõ học sinh trên máy (dòng 1 tổ trưởng, dòng 2 tổ phó), rồi tải file lên. Chuyển tổ trên web cập nhật ngay — không cần chờ từng em."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="button-secondary" href="/api/gvcn/students/template">
            Tải mẫu Excel 4 tổ
          </a>
          <a className="button-secondary" href="/api/gvcn/students/export">
            Xuất danh sách lớp
          </a>
          <label className={`button-primary ${readOnly ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
            {importBusy ? "Đang xử lý…" : "Tải Excel lên"}
            <input
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importBusy || readOnly}
              onChange={(event) => {
                importFile(event.target.files?.[0]).catch(() => setMessage("Import Excel thất bại."));
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        </div>
        {message ? <p className="mt-3 text-sm text-amber-700">{message}</p> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {teams.map((team) => (
          <article className="card p-4" key={team.teamNumber}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Tổ {team.teamNumber}</h3>
              <span className="text-sm text-slate-500">{team.members.length} em</span>
            </div>
            {!team.members.length ? (
              <p className="text-sm text-slate-400">Chưa có học sinh.</p>
            ) : (
              <ul className="space-y-2">
                {team.members.map((student, index) => {
                  const saving = pendingIds.has(student._id);
                  return (
                    <li className={`rounded-2xl bg-slate-50 p-3 ${saving ? "opacity-80" : ""}`} key={student._id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {index + 1}. {student.fullName}
                            {saving ? <span className="ml-2 text-xs font-normal text-slate-400">đang lưu…</span> : null}
                          </p>
                          <p className="text-xs text-slate-500">
                            NS {formatBirthDate(student) || "—"}
                            {student.position ? ` · ${student.position}` : ""}
                          </p>
                        </div>
                        {readOnly ? null : (
                          <button
                            className="text-xs font-semibold text-red-600"
                            onClick={() => removeStudent(student._id, student.fullName)}
                            type="button"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <select
                          disabled={readOnly || saving}
                          onChange={(event) =>
                            patchStudent(student._id, {
                              teamNumber: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                          value={student.teamNumber ?? ""}
                        >
                          <option value="">Chưa gán</option>
                          <option value="1">Sang tổ 1</option>
                          <option value="2">Sang tổ 2</option>
                          <option value="3">Sang tổ 3</option>
                          <option value="4">Sang tổ 4</option>
                        </select>
                        <select
                          disabled={readOnly || saving}
                          onChange={(event) =>
                            patchStudent(student._id, {
                              teamRole: (event.target.value || "thanhVien") as TeamRole,
                            })
                          }
                          value={student.teamRole ?? "thanhVien"}
                        >
                          <option value="toTruong">{TEAM_ROLE_LABELS.toTruong}</option>
                          <option value="toPho">{TEAM_ROLE_LABELS.toPho}</option>
                          <option value="thanhVien">{TEAM_ROLE_LABELS.thanhVien}</option>
                        </select>
                        <select
                          disabled={readOnly || saving}
                          onChange={(event) =>
                            patchStudent(student._id, { classDuty: event.target.value ? (event.target.value as ClassDuty) : null })
                          }
                          value={student.classDuty ?? ""}
                        >
                          <option value="">Chức vụ lớp</option>
                          {classDutyOptions().map((duty) => (
                            <option key={duty.value} value={duty.value}>
                              {duty.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
      </div>

      {unassigned.length ? (
        <section className="card p-4">
          <h3 className="mb-3 font-semibold">Chưa gán tổ ({unassigned.length})</h3>
          <ul className="space-y-2">
            {unassigned.map((student) => (
              <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3" key={student._id}>
                <span>{student.fullName}</span>
                <select
                  disabled={readOnly}
                  onChange={(event) =>
                    patchStudent(student._id, { teamNumber: event.target.value ? Number(event.target.value) : null })
                  }
                  value=""
                >
                  <option value="">Chuyển vào tổ…</option>
                  <option value="1">Tổ 1</option>
                  <option value="2">Tổ 2</option>
                  <option value="3">Tổ 3</option>
                  <option value="4">Tổ 4</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-slate-400">
        Bổ nhiệm lớp: {Object.values(CLASS_DUTY_LABELS).join(", ")}. Mỗi chức vụ chỉ một em; tổ trưởng/tổ phó mỗi tổ một em.
      </p>
    </section>
  );
}
