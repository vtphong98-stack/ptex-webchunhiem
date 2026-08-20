"use client";

import { useEffect, useState } from "react";

import { YEAR_MILESTONES, type Milestone, isoToVnDate, vnDateToIso } from "@/lib/academic-calendar";

export function MilestonesManager({
  readOnly = false,
  yearName,
}: {
  readOnly?: boolean;
  yearName?: string;
}) {
  const [milestones, setMilestones] = useState<Milestone[]>(YEAR_MILESTONES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const yearParam = yearName ? `?year=${encodeURIComponent(yearName)}` : "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/gvcn/milestones${yearParam}`)
      .then((res) => res.json())
      .then((res) => {
        if (cancelled) return;
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setMilestones(res.data);
        } else {
          setMilestones(YEAR_MILESTONES);
        }
        setUpdatedAt(res.updatedAt || "");
      })
      .catch(() => {
        if (!cancelled) setError("Chưa tải được mốc thời gian.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [yearParam]);

  function handleDateChange(index: number, newIso: string) {
    setMilestones((prev) => {
      const next = [...prev];
      const vnDate = isoToVnDate(newIso);
      next[index] = {
        ...next[index],
        iso: newIso,
        date: vnDate,
      };
      return next;
    });
  }

  function handleLabelChange(index: number, newLabel: string) {
    setMilestones((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        label: newLabel,
      };
      return next;
    });
  }

  function handleAddMilestone() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const newId = `event-${Date.now()}`;
    setMilestones((prev) => [
      ...prev,
      {
        id: newId,
        label: "Sự kiện mới",
        iso: todayIso,
        date: isoToVnDate(todayIso),
      },
    ]);
  }

  function handleRemoveMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function handleResetDefault() {
    if (window.confirm("Khôi phục danh sách mốc thời gian về mặc định chuẩn?")) {
      setMilestones(YEAR_MILESTONES);
    }
  }

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/gvcn/milestones${yearParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: milestones }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi lưu dữ liệu");
      }

      setUpdatedAt(data.updatedAt || new Date().toISOString());
      setMessage("Đã lưu mốc thời gian thành công! Trang chủ và đồng hồ đếm ngược đã được cập nhật.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể lưu mốc thời gian.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>📅</span> Cài đặt mốc thời gian & Ngày thi
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Điều chỉnh ngày thi Học kỳ 1, Học kỳ 2, Tốt nghiệp THPT, Thi HSG, ngày khai giảng và các sự kiện trong năm.
            Đồng hồ đếm ngược và thanh thời gian ở trang chủ sẽ tự động cập nhật theo các ngày này.
          </p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="button-secondary text-xs"
              onClick={handleResetDefault}
              type="button"
            >
              🔄 Mặc định
            </button>
            <button
              className="button-secondary text-xs"
              onClick={handleAddMilestone}
              type="button"
            >
              ➕ Thêm mốc
            </button>
            <button
              className="button-primary text-xs"
              disabled={saving || loading}
              onClick={handleSave}
              type="button"
            >
              {saving ? "Đang lưu..." : "💾 Lưu mốc thời gian"}
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs sm:text-sm font-semibold text-emerald-800 animate-fade-in">
          ✓ {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs sm:text-sm font-semibold text-rose-800">
          ✕ {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Đang tải mốc thời gian...</div>
      ) : (
        <div className="space-y-4">
          {/* Key Exam Highlight Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["hk1", "hk2", "tn"].map((id) => {
              const item = milestones.find((m) => m.id === id);
              if (!item) return null;
              const idx = milestones.indexOf(item);
              const labelShort = id === "hk1" ? "Thi Học kỳ 1 (HK1)" : id === "hk2" ? "Thi Học kỳ 2 (HK2)" : "Thi Tốt nghiệp THPT (TN)";
              return (
                <div key={id} className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{labelShort}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-100 font-bold text-indigo-800">
                      {item.date || "Chưa đặt"}
                    </span>
                  </div>
                  <input
                    className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                    disabled={readOnly}
                    onChange={(e) => handleDateChange(idx, e.target.value)}
                    type="date"
                    value={item.iso || ""}
                  />
                </div>
              );
            })}
          </div>

          {/* Full Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Tên sự kiện / Mốc thời gian</th>
                  <th className="px-4 py-3">Mã (ID)</th>
                  <th className="px-4 py-3">Chọn ngày trên lịch</th>
                  <th className="px-4 py-3 text-center">Hiển thị</th>
                  {!readOnly && <th className="px-4 py-3 text-center">Xóa</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {milestones.map((m, index) => {
                  const isSpecial = ["hk1", "hk2", "tn", "hsg", "thuc-hoc", "khai-giang"].includes(m.id);
                  return (
                    <tr key={m.id || index} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 text-xs font-bold text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                          disabled={readOnly}
                          onChange={(e) => handleLabelChange(index, e.target.value)}
                          value={m.label}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">
                        {m.id}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                          disabled={readOnly}
                          onChange={(e) => handleDateChange(index, e.target.value)}
                          type="date"
                          value={m.iso || ""}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {m.date || "Chưa có"}
                        </span>
                      </td>
                      {!readOnly && (
                        <td className="px-4 py-3 text-center">
                          {isSpecial ? (
                            <span className="text-xs text-slate-300">Cố định</span>
                          ) : (
                            <button
                              className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 transition"
                              onClick={() => handleRemoveMilestone(index)}
                              title="Xóa mốc"
                              type="button"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer status */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 pt-2">
            <span>
              {updatedAt ? `Cập nhật lần cuối: ${new Date(updatedAt).toLocaleString("vi-VN")}` : "Đang dùng thiết lập chuẩn năm học"}
            </span>
            {!readOnly && (
              <button
                className="button-primary text-xs self-end"
                disabled={saving || loading}
                onClick={handleSave}
                type="button"
              >
                {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
