"use client";

import { useMemo, useState } from "react";

type StudentInfo = {
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
};

function formatBirth(s: StudentInfo) {
  const d = `${s.birthDay}/${s.birthMonth}`;
  return s.birthYear ? `${d}/${s.birthYear}` : d;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="sl-row">
      <span className="sl-label">{label}</span>
      <span className="sl-value">{value}</span>
    </div>
  );
}

function PhoneBtn({ phone, label, primary }: { phone: string; label: string; primary?: boolean }) {
  if (!phone) return null;
  return (
    <>
      <a className={primary ? "button-primary" : "button-secondary"} href={`tel:${phone.replace(/\s/g, "")}`}>{label}</a>
      <a className="button-secondary" href={`https://zalo.me/${phone.replace(/\s/g, "")}`} rel="noreferrer" target="_blank">Zalo</a>
    </>
  );
}

export function StudentLookupPublic({ students }: { students: StudentInfo[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return students;
    return students.filter((s) =>
      [s.fullName, s.idNumber, s.fatherName, s.motherName, s.parentPhone, s.motherPhone, s.studentPhone, s.addressWard, s.addressGroup]
        .join(" ").toLowerCase().includes(q),
    );
  }, [query, students]);

  const selected = selectedId ? students.find((s) => s.id === selectedId) : null;
  const address = selected ? [selected.addressGroup, selected.addressWard, selected.addressProvince].filter(Boolean).join(", ") : "";

  return (
    <>
      <input
        className="lookup-search"
        onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
        placeholder="Tìm tên, SĐT, CCCD, phụ huynh…"
        type="search"
        value={query}
      />
      <p className="text-sm text-slate-500 mb-3">Tìm thấy {filtered.length}/{students.length} học sinh</p>

      {/* Detail panel */}
      {selected ? (
        <div className="sl-detail">
          <div className="sl-detail-header">
            <div className="sl-detail-avatar">{selected.fullName.split(" ").pop()?.[0]}</div>
            <div>
              <h3 className="sl-detail-name">{selected.fullName}</h3>
              <p className="sl-detail-meta">
                🎂 {formatBirth(selected)}
                {selected.position ? ` · ${selected.position}` : ""}
                {selected.classRole ? ` · ${selected.classRole}` : ""}
                {selected.teamNumber ? ` · Tổ ${selected.teamNumber}` : ""}
              </p>
            </div>
            <button className="sl-close" onClick={() => setSelectedId(null)}>✕</button>
          </div>
          <div className="sl-detail-body">
            <div className="sl-grid">
              <Row label="Giới tính" value={selected.gender} />
              <Row label="Dân tộc" value={selected.ethnicity} />
              <Row label="Nơi sinh" value={selected.birthPlace} />
              <Row label="CCCD" value={selected.idNumber} />
              <Row label="Nơi ở" value={address} />
              <Row label="Cha" value={[selected.fatherName, selected.fatherJob].filter(Boolean).join(" · ")} />
              <Row label="Mẹ" value={[selected.motherName, selected.motherJob].filter(Boolean).join(" · ")} />
              <Row label="SĐT phụ huynh" value={selected.parentPhone} />
              <Row label="SĐT của mẹ" value={selected.motherPhone} />
              <Row label="SĐT học sinh" value={selected.studentPhone} />
              <Row label="Email" value={selected.email} />
              <Row label="Ghi chú" value={selected.notes} />
            </div>
            <div className="sl-actions">
              <PhoneBtn phone={selected.parentPhone} label="Gọi phụ huynh" primary />
              <PhoneBtn phone={selected.motherPhone} label="Gọi mẹ" />
              <PhoneBtn phone={selected.studentPhone} label="Gọi học sinh" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Student grid */}
      <div className="lookup-grid">
        {filtered.map((s) => (
          <div
            key={s.id}
            className={`lookup-card ${selectedId === s.id ? "lookup-card-active" : ""}`}
            onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
            style={{ cursor: "pointer" }}
          >
            <div className="lookup-avatar">{s.fullName.split(" ").pop()?.[0]}</div>
            <div className="lookup-info">
              <strong>{s.fullName}</strong>
              <span>🎂 {formatBirth(s)}</span>
              {s.teamNumber ? <span>Tổ {s.teamNumber}{s.position ? ` · ${s.position}` : ""}</span> : null}
            </div>
          </div>
        ))}
      </div>
      {!filtered.length && <p style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Không tìm thấy học sinh nào.</p>}
    </>
  );
}
