"use client";

import { useMemo, useState } from "react";

import type { ContactCard } from "@/lib/phone";
import { telHref, zaloHref } from "@/lib/phone";

export function ContactDirectoryTabs({
  parents,
  students,
}: {
  parents: ContactCard[];
  students: ContactCard[];
}) {
  const [tab, setTab] = useState<"parents" | "students">("parents");
  const [query, setQuery] = useState("");

  const currentItems = tab === "parents" ? parents : students;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return currentItems;
    return currentItems.filter((item) =>
      `${item.fullName} ${item.subtitle} ${item.phone}`.toLowerCase().includes(needle),
    );
  }, [currentItems, query]);

  return (
    <div className="contact-tabs-container">
      {/* 2 Tab Switcher Buttons */}
      <div className="contact-tab-switch">
        <button
          className={`contact-tab-btn ${tab === "parents" ? "contact-tab-active" : ""}`}
          onClick={() => {
            setTab("parents");
            setQuery("");
          }}
          type="button"
        >
          <span className="contact-tab-icon">👨‍👩‍👧‍👦</span>
          <span>Phụ huynh</span>
          <span className="contact-tab-badge">{parents.length}</span>
        </button>

        <button
          className={`contact-tab-btn ${tab === "students" ? "contact-tab-active" : ""}`}
          onClick={() => {
            setTab("students");
            setQuery("");
          }}
          type="button"
        >
          <span className="contact-tab-icon">🎓</span>
          <span>Học sinh</span>
          <span className="contact-tab-badge">{students.length}</span>
        </button>
      </div>

      {/* Search Input */}
      <input
        className="contact-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          tab === "parents"
            ? "Tìm học sinh / tên cha mẹ / SĐT phụ huynh…"
            : "Tìm học sinh / chức vụ / SĐT học sinh…"
        }
        type="search"
        value={query}
      />

      <p className="text-sm text-slate-500 mb-3" style={{ textAlign: "center" }}>
        Đang xem danh bạ {tab === "parents" ? "Phụ huynh" : "Học sinh"} · {filtered.length}/{currentItems.length} kết quả
      </p>

      {/* Directory Grid */}
      {!filtered.length ? (
        <p className="contact-empty">
          {currentItems.length
            ? "Không tìm thấy kết quả nào phù hợp."
            : tab === "parents"
              ? "Chưa có số phụ huynh. Học sinh điền sơ yếu lý lịch để hiện danh sách gọi nhanh."
              : "Chưa có SĐT học sinh. Em điền sơ yếu lý lịch để GVCN và lớp liên hệ nhanh."}
        </p>
      ) : (
        <div className="contact-grid">
          {filtered.map((item) => {
            const call = telHref(item.phone);
            const zalo = zaloHref(item.phone);
            return (
              <article className="contact-card" key={item.id}>
                <h2>{item.fullName}</h2>
                {item.subtitle ? <p>{item.subtitle}</p> : null}
                <p className="contact-phone">{item.phone || "Chưa có số điện thoại"}</p>
                <div className="contact-actions">
                  {call ? (
                    <a className="contact-call" href={call}>
                      Gọi điện
                    </a>
                  ) : (
                    <span className="contact-disabled">Gọi điện</span>
                  )}
                  {zalo ? (
                    <a className="contact-zalo" href={zalo} rel="noreferrer" target="_blank">
                      Zalo
                    </a>
                  ) : (
                    <span className="contact-disabled">Zalo</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
