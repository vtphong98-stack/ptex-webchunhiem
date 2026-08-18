"use client";

import { useMemo, useState } from "react";

import type { ContactCard } from "@/lib/phone";
import { telHref, zaloHref } from "@/lib/phone";

export function ContactDirectory({
  emptyHint,
  items,
  kind,
}: {
  emptyHint: string;
  items: ContactCard[];
  kind: "parents" | "students";
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.fullName} ${item.subtitle} ${item.phone}`.toLowerCase().includes(needle));
  }, [items, query]);

  return (
    <>
      <input
        className="contact-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={kind === "parents" ? "Tìm học sinh / phụ huynh / SĐT…" : "Tìm học sinh / SĐT…"}
        value={query}
      />
      {!filtered.length ? (
        <p className="contact-empty">{items.length ? "Không khớp từ khóa." : emptyHint}</p>
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
    </>
  );
}
