"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClassTargets, FourLevelMetric, HomeroomAcademicMetric, SubjectClassTarget, TargetMetric } from "@/lib/types";

function makeDefaultSubjectClass(id: string, name: string, total: number): SubjectClassTarget {
  const totCnt = Math.round(total * 0.7);
  const khaCnt = Math.round(total * 0.25);
  const datCnt = total - totCnt - khaCnt;
  return {
    id,
    className: name,
    totalStudents: total,
    subject: "Toán",
    tot: { count: totCnt, percent: total > 0 ? Number(((totCnt / total) * 100).toFixed(1)) : 0 },
    kha: { count: khaCnt, percent: total > 0 ? Number(((khaCnt / total) * 100).toFixed(1)) : 0 },
    dat: { count: Math.max(datCnt, 0), percent: total > 0 ? Number(((Math.max(datCnt, 0) / total) * 100).toFixed(1)) : 0 },
    chuaDat: { count: 0, percent: 0 },
  };
}

const DEFAULT_TARGETS: ClassTargets = {
  schoolYear: "2026-2027",
  homeroom: {
    className: "12A1",
    totalStudents: 48,
    conduct: {
      tot: { count: 44, percent: 91.7 },
      kha: { count: 4, percent: 8.3 },
      dat: { count: 0, percent: 0 },
      chuaDat: { count: 0, percent: 0 },
    },
    academic: {
      tot: { count: 34, percent: 70.8 },
      kha: { count: 12, percent: 25.0 },
      dat: { count: 2, percent: 4.2 },
      chuaDat: { count: 0, percent: 0 },
      xuatSac: { count: 12, percent: 25.0 },
    },
  },
  subjectTeaching: {
    subjectName: "Toán",
    classes: [
      {
        id: "cls-12a1",
        className: "12A1",
        totalStudents: 48,
        subject: "Toán",
        tot: { count: 34, percent: 70.8 },
        kha: { count: 12, percent: 25.0 },
        dat: { count: 2, percent: 4.2 },
        chuaDat: { count: 0, percent: 0 },
      },
      {
        id: "cls-11a1",
        className: "11A1",
        totalStudents: 45,
        subject: "Toán",
        tot: { count: 30, percent: 66.7 },
        kha: { count: 13, percent: 28.9 },
        dat: { count: 2, percent: 4.4 },
        chuaDat: { count: 0, percent: 0 },
      },
    ],
  },
  otherTargets: {
    hocSinhGioi: "8 HSG cấp trường, 2 HSG cấp tỉnh",
    totNghiepThpt: "100% tốt nghiệp THPT",
    daiHocCaoDang: ">= 90% trúng tuyển Đại học, Cao đẳng",
    danhHieuLop: "Tập thể Lớp Tiên tiến Xuất sắc",
    phongTrao: "Đạt giải Nhất/Nhì các phong trào thi đua Đoàn trường",
    ghiChu: "100% học sinh chấp hành tốt pháp luật và nội quy nhà trường",
  },
};

export function TargetsManager({
  readOnly = false,
  yearName,
}: {
  readOnly?: boolean;
  yearName?: string;
}) {
  const [targets, setTargets] = useState<ClassTargets>(DEFAULT_TARGETS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/gvcn/targets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data) {
          const raw = d.data;
          const hrTotal = raw.homeroom?.totalStudents || raw.totalStudents || 48;
          const oldCond = raw.homeroom?.conduct || raw.conduct || {};
          const oldAc = raw.homeroom?.academic || raw.academic || {};
          const oldClasses = raw.subjectTeaching?.classes || raw.academicClasses || [];

          const normalized: ClassTargets = {
            schoolYear: raw.schoolYear || yearName || "2026-2027",
            homeroom: {
              className: raw.homeroom?.className || "12A1",
              totalStudents: hrTotal,
              conduct: {
                tot: oldCond.tot || { count: 44, percent: 91.7 },
                kha: oldCond.kha || { count: 4, percent: 8.3 },
                dat: oldCond.dat || { count: 0, percent: 0 },
                chuaDat: oldCond.chuaDat || { count: 0, percent: 0 },
              },
              academic: {
                tot: oldAc.tot || oldAc.gioi || { count: 34, percent: 70.8 },
                kha: oldAc.kha || { count: 12, percent: 25.0 },
                dat: oldAc.dat || { count: 2, percent: 4.2 },
                chuaDat: oldAc.chuaDat || { count: 0, percent: 0 },
                xuatSac: oldAc.xuatSac || { count: 12, percent: 25.0 },
              },
            },
            subjectTeaching: {
              subjectName: raw.subjectTeaching?.subjectName || "Toán",
              classes: oldClasses.length
                ? oldClasses.map((c: any) => ({
                    id: c.id || `cls-${Math.random()}`,
                    className: c.className || "Lớp",
                    totalStudents: c.totalStudents || 45,
                    subject: c.subject || "Toán",
                    tot: c.tot || {
                      count: (c.xuatSac?.count || 0) + (c.gioi?.count || 0) || Math.round(c.totalStudents * 0.7),
                      percent: 70.0,
                    },
                    kha: c.kha || { count: Math.round(c.totalStudents * 0.25), percent: 25.0 },
                    dat: c.dat || { count: Math.round(c.totalStudents * 0.05), percent: 5.0 },
                    chuaDat: c.chuaDat || { count: 0, percent: 0 },
                  }))
                : DEFAULT_TARGETS.subjectTeaching.classes,
            },
            otherTargets: raw.otherTargets || DEFAULT_TARGETS.otherTargets,
            updatedAt: raw.updatedAt,
          };
          setTargets(normalized);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [yearName]);

  const hrTotal = targets.homeroom?.totalStudents || 48;

  // Update Homeroom Conduct (4 levels: Tốt, Khá, Đạt, Chưa đạt)
  function updateHomeroomConduct(key: keyof FourLevelMetric, countVal: number) {
    const percent = hrTotal > 0 ? Number(((countVal / hrTotal) * 100).toFixed(1)) : 0;
    setTargets((prev) => ({
      ...prev,
      homeroom: {
        ...prev.homeroom,
        conduct: {
          ...prev.homeroom.conduct,
          [key]: { count: countVal, percent },
        },
      },
    }));
  }

  // Update Homeroom Academic (4 basic levels + Xuất sắc xét riêng trên toàn lớp)
  function updateHomeroomAcademic(key: keyof HomeroomAcademicMetric, countVal: number) {
    const percent = hrTotal > 0 ? Number(((countVal / hrTotal) * 100).toFixed(1)) : 0;
    setTargets((prev) => ({
      ...prev,
      homeroom: {
        ...prev.homeroom,
        academic: {
          ...prev.homeroom.academic,
          [key]: { count: countVal, percent },
        },
      },
    }));
  }

  // Update Subject Class fields
  function updateSubjectClassField(classIndex: number, field: string, value: unknown) {
    setTargets((prev) => {
      const copy = [...prev.subjectTeaching.classes];
      copy[classIndex] = { ...copy[classIndex], [field]: value };
      return {
        ...prev,
        subjectTeaching: {
          ...prev.subjectTeaching,
          classes: copy,
        },
      };
    });
  }

  // Update Subject Class Metric (4 levels: Tốt, Khá, Đạt, Chưa đạt)
  function updateSubjectClassMetric(classIndex: number, metricKey: keyof FourLevelMetric, countVal: number) {
    setTargets((prev) => {
      const copy = [...prev.subjectTeaching.classes];
      const cls = copy[classIndex];
      const clsTotal = cls.totalStudents || 1;
      const percent = Number(((countVal / clsTotal) * 100).toFixed(1));
      copy[classIndex] = {
        ...cls,
        [metricKey]: { count: countVal, percent },
      };
      return {
        ...prev,
        subjectTeaching: {
          ...prev.subjectTeaching,
          classes: copy,
        },
      };
    });
  }

  function addSubjectClass() {
    const id = `cls-${Date.now()}`;
    const newCls = makeDefaultSubjectClass(id, `Lớp mới ${targets.subjectTeaching.classes.length + 1}`, 45);
    setTargets((prev) => ({
      ...prev,
      subjectTeaching: {
        ...prev.subjectTeaching,
        classes: [...prev.subjectTeaching.classes, newCls],
      },
    }));
  }

  function removeSubjectClass(index: number) {
    if (targets.subjectTeaching.classes.length <= 1) {
      alert("Cần giữ lại ít nhất 1 lớp giảng dạy.");
      return;
    }
    setTargets((prev) => ({
      ...prev,
      subjectTeaching: {
        ...prev.subjectTeaching,
        classes: prev.subjectTeaching.classes.filter((_, i) => i !== index),
      },
    }));
  }

  function updateOther(key: string, val: string) {
    setTargets((prev) => ({
      ...prev,
      otherTargets: {
        ...prev.otherTargets,
        [key]: val,
      },
    }));
  }

  // Overall Subject Teaching Totals (Tổng hợp bộ môn Toán)
  const overallSubject = useMemo(() => {
    const classes = targets.subjectTeaching?.classes || [];
    let totalAll = 0;
    let sumTot = 0;
    let sumKha = 0;
    let sumDat = 0;
    let sumChuaDat = 0;

    for (const c of classes) {
      totalAll += Number(c.totalStudents) || 0;
      sumTot += Number(c.tot?.count) || 0;
      sumKha += Number(c.kha?.count) || 0;
      sumDat += Number(c.dat?.count) || 0;
      sumChuaDat += Number(c.chuaDat?.count) || 0;
    }

    const calcP = (cnt: number) => (totalAll > 0 ? Number(((cnt / totalAll) * 100).toFixed(1)) : 0);

    return {
      totalAll,
      classCount: classes.length,
      tot: { count: sumTot, percent: calcP(sumTot) },
      kha: { count: sumKha, percent: calcP(sumKha) },
      dat: { count: sumDat, percent: calcP(sumDat) },
      chuaDat: { count: sumChuaDat, percent: calcP(sumChuaDat) },
      goodTotalPercent: calcP(sumTot + sumKha),
    };
  }, [targets.subjectTeaching?.classes]);

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/gvcn/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: targets }),
      });
      if (res.ok) {
        setMsg({ type: "ok", text: "✓ Đã lưu chỉ tiêu năm học thành công!" });
      } else {
        const d = await res.json();
        setMsg({ type: "err", text: d.error || "Lỗi lưu dữ liệu" });
      }
    } catch {
      setMsg({ type: "err", text: "Không thể kết nối máy chủ" });
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="card p-6 text-center text-slate-500">Đang tải chỉ tiêu…</div>;
  }

  return (
    <section className="card ct-root space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">🎯 Thiết Lập Chỉ Tiêu Năm Học {yearName || targets.schoolYear}</h2>
          <p className="text-sm text-slate-500 mt-1">
            <strong>Chủ nhiệm</strong> (Rèn luyện 4 mức · Học lực 4 mức 100% + Xuất sắc xét riêng) và <strong>Bộ môn Toán</strong> (Theo từng lớp · 4 mức Tốt/Khá/Đạt/Chưa đạt).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            className="button-secondary text-sm"
            href="/chi-tieu"
            target="_blank"
            rel="noreferrer"
          >
            🔗 Xem trang Chỉ tiêu
          </a>
          {!readOnly && (
            <button
              className="button-primary"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              {saving ? "Đang lưu…" : "💾 Lưu chỉ tiêu"}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold ${
            msg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ======================================================== */}
      {/* PHẦN A: CÔNG TÁC CHỦ NHIỆM                               */}
      {/* ======================================================== */}
      <div className="ct-panel border-2 border-indigo-200 rounded-3xl bg-indigo-50/20 space-y-6 shadow-sm">
        <div className="ct-head border-b border-indigo-100 pb-3">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full">
              PHẦN A
            </span>
            <h3 className="text-lg font-black text-indigo-950 mt-1">
              👑 CHỈ TIÊU CÔNG TÁC CHỦ NHIỆM — LỚP {targets.homeroom?.className || "12A1"}
            </h3>
          </div>
          <div className="ct-count">
            <span>Sĩ số lớp chủ nhiệm:</span>
            <span className="ct-count-num">
              <input
                type="number"
                min={1}
                max={100}
                disabled={readOnly}
                value={targets.homeroom?.totalStudents || 48}
                onChange={(e) => {
                  const num = parseInt(e.target.value) || 0;
                  setTargets((prev) => ({
                    ...prev,
                    homeroom: { ...prev.homeroom, totalStudents: num },
                  }));
                  if (num > 0) {
                    ["tot", "kha", "dat", "chuaDat"].forEach((k) => {
                      const c = (targets.homeroom.conduct as unknown as Record<string, TargetMetric>)[k]?.count || 0;
                      updateHomeroomConduct(k as keyof FourLevelMetric, c);
                    });
                    ["tot", "kha", "dat", "chuaDat", "xuatSac"].forEach((k) => {
                      const c = (targets.homeroom.academic as unknown as Record<string, TargetMetric>)[k]?.count || 0;
                      updateHomeroomAcademic(k as keyof HomeroomAcademicMetric, c);
                    });
                  }
                }}
                className="ct-num"
              />
              HS
            </span>
          </div>
        </div>

        {/* 1. Rèn luyện lớp chủ nhiệm (4 mức: Tốt, Khá, Đạt, Chưa đạt - KHÔNG CÓ XUẤT SẮC) */}
        <div className="ct-block bg-white rounded-2xl border border-slate-200 space-y-3">
          <div className="ct-head border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <span>🌟</span> 1. Rèn luyện (Hạnh kiểm)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">4 mức đánh giá · Tổng = 100% sĩ số</p>
            </div>
            <span className="ct-chip">Tốt: {targets.homeroom.conduct.tot.percent}%</span>
          </div>

          <div className="ct-metrics">
            {[
              { key: "tot", label: "TỐT", color: "text-emerald-700 bg-emerald-50/80 border-emerald-200" },
              { key: "kha", label: "KHÁ", color: "text-blue-700 bg-blue-50/80 border-blue-200" },
              { key: "dat", label: "ĐẠT", color: "text-amber-700 bg-amber-50/80 border-amber-200" },
              { key: "chuaDat", label: "CHƯA ĐẠT", color: "text-rose-700 bg-rose-50/80 border-rose-200" },
            ].map(({ key, label, color }) => {
              const val = targets.homeroom.conduct[key as keyof FourLevelMetric] || { count: 0, percent: 0 };
              return (
                <div key={key} className={`ct-metric ${color}`}>
                  <span className="ct-metric-label">{label}</span>
                  <div className="ct-metric-field">
                    <input
                      type="number"
                      min={0}
                      disabled={readOnly}
                      value={val.count}
                      onChange={(e) => updateHomeroomConduct(key as keyof FourLevelMetric, parseInt(e.target.value) || 0)}
                      className="ct-num"
                    />
                    <span>HS</span>
                  </div>
                  <span className="ct-metric-pct">
                    {val.percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Học tập lớp chủ nhiệm (4 mức cơ bản 100% + Xuất sắc xét riêng tính % toàn lớp) */}
        <div className="ct-block bg-white rounded-2xl border border-slate-200 space-y-4">
          <div className="ct-head border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <span>📚</span> 2. Học tập (Học lực cả năm) — Lớp {targets.homeroom?.className}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Vốn dĩ 4 mức <strong>Tốt · Khá · Đạt · Chưa đạt</strong> là 100%. Danh hiệu <strong>Xuất sắc</strong> được xét riêng tính % trên toàn bộ {hrTotal} học sinh lớp.
              </p>
            </div>
            <span className="ct-chip">
              Tốt + Khá: {((targets.homeroom.academic.tot?.percent || 0) + (targets.homeroom.academic.kha?.percent || 0)).toFixed(1)}%
            </span>
          </div>

          {/* KHỐI XUẤT SẮC XÉT RIÊNG */}
          <div className="ct-star bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 border-2 border-purple-300 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="ct-star-icon">🏆</div>
              <div className="min-w-0">
                <span className="text-xs font-black text-purple-950 uppercase tracking-wider block">
                  DANH HIỆU HỌC SINH XUẤT SẮC (XÉT RIÊNG)
                </span>
                <span className="block text-xs text-purple-700 font-medium leading-snug mt-0.5">
                  Chỉ tiêu khen thưởng tính % trên tổng số {hrTotal} học sinh toàn lớp
                </span>
              </div>
            </div>
            <div className="ct-count">
              <span>Chỉ tiêu Xuất sắc:</span>
              <span className="ct-count-num">
                <input
                  type="number"
                  min={0}
                  disabled={readOnly}
                  value={targets.homeroom.academic.xuatSac?.count ?? 0}
                  onChange={(e) => updateHomeroomAcademic("xuatSac", parseInt(e.target.value) || 0)}
                  className="ct-num"
                />
                HS
              </span>
              <em className="ct-star-pct">{targets.homeroom.academic.xuatSac?.percent ?? 0}% toàn lớp</em>
            </div>
          </div>

          {/* 4 MỨC XẾP LOẠI CƠ BẢN (100% SĨ SỐ) */}
          <div className="space-y-1.5">
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider block">
              4 Mức Xếp Loại Học Lực Cơ Bản (Tổng = 100% Sĩ số)
            </span>
            <div className="ct-metrics">
              {[
                { key: "tot", label: "TỐT (GIỎI)", color: "text-emerald-700 bg-emerald-50/80 border-emerald-200" },
                { key: "kha", label: "KHÁ", color: "text-blue-700 bg-blue-50/80 border-blue-200" },
                { key: "dat", label: "ĐẠT", color: "text-amber-700 bg-amber-50/80 border-amber-200" },
                { key: "chuaDat", label: "CHƯA ĐẠT", color: "text-rose-700 bg-rose-50/80 border-rose-200" },
              ].map(({ key, label, color }) => {
                const val = (targets.homeroom.academic as unknown as Record<string, TargetMetric>)[key] || { count: 0, percent: 0 };
                return (
                  <div key={key} className={`ct-metric ${color}`}>
                    <span className="ct-metric-label">{label}</span>
                    <div className="ct-metric-field">
                      <input
                        type="number"
                        min={0}
                        disabled={readOnly}
                        value={val.count}
                        onChange={(e) => updateHomeroomAcademic(key as keyof HomeroomAcademicMetric, parseInt(e.target.value) || 0)}
                        className="ct-num"
                      />
                      <span>HS</span>
                    </div>
                    <span className="ct-metric-pct">
                      {val.percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PHẦN B: GIẢNG DẠY BỘ MÔN TOÁN                            */}
      {/* ======================================================== */}
      <div className="ct-panel border-2 border-sky-200 rounded-3xl bg-sky-50/20 space-y-6 shadow-sm">
        <div className="ct-head border-b border-sky-100 pb-3">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-sky-600 bg-sky-100 px-2.5 py-0.5 rounded-full">
              PHẦN B
            </span>
            <h3 className="text-lg font-black text-sky-950 mt-1">
              📐 CHỈ TIÊU GIẢNG DẠY BỘ MÔN TOÁN (THEO TỪNG LỚP)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Đánh giá theo 4 mức: <strong>TỐT · KHÁ · ĐẠT · CHƯA ĐẠT</strong> (mức cao nhất là Tốt, không có Xuất sắc). Tự động tổng hợp toàn bộ các lớp.
            </p>
          </div>
          {!readOnly && (
            <button
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
              onClick={addSubjectClass}
              type="button"
            >
              <span>➕</span> Thêm lớp dạy Toán
            </button>
          )}
        </div>

        {/* Danh sách từng lớp bộ môn */}
        <div className="space-y-4">
          {targets.subjectTeaching.classes.map((cls, idx) => (
            <div key={cls.id || idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="ct-class-head">
                <div className="ct-field">
                  <span>Tên lớp:</span>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={cls.className}
                    onChange={(e) => updateSubjectClassField(idx, "className", e.target.value)}
                    placeholder="VD: 12A1"
                  />
                </div>
                <div className="ct-field">
                  <span>Sĩ số:</span>
                  <span className="ct-count-num">
                    <input
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={cls.totalStudents}
                      onChange={(e) => {
                        const num = parseInt(e.target.value) || 0;
                        updateSubjectClassField(idx, "totalStudents", num);
                        if (num > 0) {
                          ["tot", "kha", "dat", "chuaDat"].forEach((k) => {
                            const cur = (cls as unknown as Record<string, TargetMetric>)[k]?.count || 0;
                            updateSubjectClassMetric(idx, k as keyof FourLevelMetric, cur);
                          });
                        }
                      }}
                      className="ct-num"
                    />
                    HS
                  </span>
                </div>

                {!readOnly && targets.subjectTeaching.classes.length > 1 && (
                  <button
                    className="ct-remove"
                    onClick={() => removeSubjectClass(idx)}
                    type="button"
                    title="Xóa lớp này"
                  >
                    🗑️ Xóa
                  </button>
                )}
              </div>

              {/* 4 mức: Tốt, Khá, Đạt, Chưa đạt */}
              <div className="ct-metrics">
                {[
                  { key: "tot", label: "TỐT", color: "text-emerald-700 bg-emerald-50/80 border-emerald-200" },
                  { key: "kha", label: "KHÁ", color: "text-blue-700 bg-blue-50/80 border-blue-200" },
                  { key: "dat", label: "ĐẠT", color: "text-amber-700 bg-amber-50/80 border-amber-200" },
                  { key: "chuaDat", label: "CHƯA ĐẠT", color: "text-rose-700 bg-rose-50/80 border-rose-200" },
                ].map(({ key, label, color }) => {
                  const val = cls[key as keyof FourLevelMetric] || { count: 0, percent: 0 };
                  return (
                    <div key={key} className={`ct-metric ${color}`}>
                      <span className="ct-metric-label">{label}</span>
                      <div className="ct-metric-field">
                        <input
                          type="number"
                          min={0}
                          disabled={readOnly}
                          value={val.count}
                          onChange={(e) => updateSubjectClassMetric(idx, key as keyof FourLevelMetric, parseInt(e.target.value) || 0)}
                          className="ct-num"
                        />
                        <span>HS</span>
                      </div>
                      <span className="ct-metric-pct">
                        {val.percent}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* BẢNG TỔNG HỢP BỘ MÔN TOÁN */}
        <div className="ct-block bg-gradient-to-r from-slate-900 to-sky-950 text-white rounded-2xl shadow-md space-y-3">
          <div className="ct-head border-b border-white/10 pb-2.5">
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-sky-300 flex items-center gap-2">
              <span>📊</span> TỔNG HỢP BỘ MÔN TOÁN ({overallSubject.classCount} LỚP · {overallSubject.totalAll} HỌC SINH)
            </h4>
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
              Tốt + Khá toàn khối: {overallSubject.goodTotalPercent}%
            </span>
          </div>

          <div className="ct-metrics">
            {[
              { label: "TỐT", val: overallSubject.tot, color: "text-emerald-300 bg-emerald-500/15" },
              { label: "KHÁ", val: overallSubject.kha, color: "text-sky-300 bg-sky-500/15" },
              { label: "ĐẠT", val: overallSubject.dat, color: "text-amber-300 bg-amber-500/15" },
              { label: "CHƯA ĐẠT", val: overallSubject.chuaDat, color: "text-rose-300 bg-rose-500/15" },
            ].map(({ label, val, color }) => (
              <div key={label} className={`ct-metric border-white/10 ${color}`}>
                <span className="ct-metric-label opacity-80">{label}</span>
                <span className="text-xl font-black block my-1">{val.count} <span className="text-xs font-normal opacity-70">HS</span></span>
                <span className="ct-metric-pct text-white">{val.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PHẦN C: DANH HIỆU, THI CỬ & PHONG TRÀO                   */}
      {/* ======================================================== */}
      <div className="ct-panel border border-amber-200 rounded-3xl bg-amber-50/20 space-y-4">
        <h3 className="text-base font-bold text-amber-900 flex items-center gap-2 border-b border-amber-100 pb-2">
          <span>🏆</span> PHẦN C: Danh hiệu, Thi tốt nghiệp & Phong trào
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Danh hiệu lớp phấn đấu</label>
            <input
              type="text"
              disabled={readOnly}
              value={targets.otherTargets?.danhHieuLop || ""}
              onChange={(e) => updateOther("danhHieuLop", e.target.value)}
              placeholder="VD: Tập thể Lớp Tiên tiến Xuất sắc"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tỉ lệ Đỗ Tốt nghiệp THPT</label>
            <input
              type="text"
              disabled={readOnly}
              value={targets.otherTargets?.totNghiepThpt || ""}
              onChange={(e) => updateOther("totNghiepThpt", e.target.value)}
              placeholder="VD: 100%"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tỉ lệ Trúng tuyển Đại học / CĐ</label>
            <input
              type="text"
              disabled={readOnly}
              value={targets.otherTargets?.daiHocCaoDang || ""}
              onChange={(e) => updateOther("daiHocCaoDang", e.target.value)}
              placeholder="VD: >= 90%"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Học sinh giỏi cấp Trường / Tỉnh</label>
            <input
              type="text"
              disabled={readOnly}
              value={targets.otherTargets?.hocSinhGioi || ""}
              onChange={(e) => updateOther("hocSinhGioi", e.target.value)}
              placeholder="VD: 8 giải cấp trường, 2 giải cấp tỉnh"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">Phong trào & Kế hoạch khác</label>
            <textarea
              rows={2}
              disabled={readOnly}
              value={targets.otherTargets?.phongTrao || ""}
              onChange={(e) => updateOther("phongTrao", e.target.value)}
              placeholder="VD: Tham gia 100% phong trào văn nghệ, hội thao..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
