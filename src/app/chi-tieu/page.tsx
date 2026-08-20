import Link from "next/link";

import { requireGvcn } from "@/lib/access";
import { CLASS_SITE } from "@/lib/class-site";
import { getTargetsServer } from "@/lib/public-site";
import type { ClassTargets, FourLevelMetric, HomeroomAcademicMetric, SubjectClassTarget } from "@/lib/types";

export const revalidate = 30;

export const metadata = {
  title: `Chỉ tiêu năm học · ${CLASS_SITE.fullName}`,
  description: `Chỉ tiêu rèn luyện và học tập năm học ${CLASS_SITE.schoolYear}`,
};

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

export default async function ChiTieuPage() {
  await requireGvcn("/chi-tieu");

  const { data } = await getTargetsServer();
  const raw = data as any;

  let targets: ClassTargets = DEFAULT_TARGETS;
  if (raw) {
    const hrTotal = raw.homeroom?.totalStudents || raw.totalStudents || 48;
    const oldCond = raw.homeroom?.conduct || raw.conduct || {};
    const oldAc = raw.homeroom?.academic || raw.academic || {};
    const oldClasses = raw.subjectTeaching?.classes || raw.academicClasses || [];

    targets = {
      schoolYear: raw.schoolYear || "2026-2027",
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
  }

  const subjectClasses = targets.subjectTeaching?.classes || [];

  // Calculate Overall Subject Totals (Tổng hợp bộ môn Toán)
  let totalSubStudents = 0;
  let sumTot = 0;
  let sumKha = 0;
  let sumDat = 0;
  let sumChuaDat = 0;

  for (const c of subjectClasses) {
    totalSubStudents += Number(c.totalStudents) || 0;
    sumTot += Number(c.tot?.count) || 0;
    sumKha += Number(c.kha?.count) || 0;
    sumDat += Number(c.dat?.count) || 0;
    sumChuaDat += Number(c.chuaDat?.count) || 0;
  }

  const calcP = (cnt: number) =>
    totalSubStudents > 0 ? Number(((cnt / totalSubStudents) * 100).toFixed(1)) : 0;

  const overallSub = {
    totalSubStudents,
    classCount: subjectClasses.length,
    tot: { count: sumTot, percent: calcP(sumTot) },
    kha: { count: sumKha, percent: calcP(sumKha) },
    dat: { count: sumDat, percent: calcP(sumDat) },
    chuaDat: { count: sumChuaDat, percent: calcP(sumChuaDat) },
    goodTotalPercent: calcP(sumTot + sumKha),
  };

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell max-w-4xl mx-auto space-y-7">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-indigo-600 font-bold hover:underline">
            ← Trang chủ
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-600 font-bold hover:underline">
            ⚙️ Vào Setup chỉnh sửa
          </Link>
        </div>

        {/* Hero Header */}
        <section className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              Kế hoạch & Mục tiêu năm học {CLASS_SITE.schoolYear}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              🎯 Chỉ Tiêu Chủ Nhiệm & Giảng Dạy Bộ Môn
            </h1>
            <p className="text-indigo-200 text-sm sm:text-base mt-2 font-medium">
              Thầy {CLASS_SITE.gvcnName} · Lớp chủ nhiệm: <strong>{targets.homeroom?.className || CLASS_SITE.className}</strong> ({targets.homeroom?.totalStudents} HS) · Giảng dạy môn Toán: <strong>{overallSub.classCount}</strong> lớp ({overallSub.totalSubStudents} HS)
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        </section>

        {/* ======================================================== */}
        {/* PHẦN A: CÔNG TÁC CHỦ NHIỆM                               */}
        {/* ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-indigo-600 pb-2">
            <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-md uppercase">
              PHẦN A
            </span>
            <h2 className="text-xl font-black text-slate-800">
              CHỈ TIÊU CÔNG TÁC CHỦ NHIỆM — LỚP {targets.homeroom?.className || "12A1"}
            </h2>
            <span className="text-xs font-semibold text-slate-500 ml-auto">
              Sĩ số: <strong>{targets.homeroom?.totalStudents}</strong> HS
            </span>
          </div>

          {/* 1. Rèn luyện lớp chủ nhiệm (4 mức: Tốt, Khá, Đạt, Chưa đạt = 100%) */}
          <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>🌟</span> 1. Chỉ tiêu Rèn luyện (Hạnh kiểm) — <span className="text-emerald-700 font-bold">4 mức đánh giá (Tổng = 100%)</span>
              </h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Tốt: {targets.homeroom.conduct.tot.percent}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "TỐT", val: targets.homeroom.conduct.tot, color: "from-emerald-500 to-teal-600", bg: "bg-emerald-50/70 text-emerald-900 border-emerald-200" },
                { label: "KHÁ", val: targets.homeroom.conduct.kha, color: "from-blue-500 to-cyan-600", bg: "bg-blue-50/70 text-blue-900 border-blue-200" },
                { label: "ĐẠT", val: targets.homeroom.conduct.dat, color: "from-amber-500 to-orange-600", bg: "bg-amber-50/70 text-amber-900 border-amber-200" },
                { label: "CHƯA ĐẠT", val: targets.homeroom.conduct.chuaDat, color: "from-rose-500 to-red-600", bg: "bg-rose-50/70 text-rose-900 border-rose-200" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} className={`border-2 rounded-2xl p-4 text-center ${bg} shadow-sm flex flex-col justify-between`}>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600">{label}</span>
                  <div className="my-2">
                    <span className="text-2xl font-black">{val?.count ?? 0}</span>
                    <span className="text-xs font-bold text-slate-500 ml-1">HS</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color}`}
                      style={{ width: `${Math.min(val?.percent ?? 0, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-black">{val?.percent ?? 0}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Học tập lớp chủ nhiệm (4 mức cơ bản 100% + Xuất sắc xét riêng) */}
          <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>📚</span> 2. Chỉ tiêu Học tập (Học lực cả năm) — Lớp {targets.homeroom?.className}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vốn dĩ 4 mức <strong>Tốt · Khá · Đạt · Chưa đạt</strong> là 100%. Danh hiệu <strong>Xuất sắc</strong> được xét riêng tính % trên toàn bộ học sinh lớp.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Tốt + Khá: {((targets.homeroom.academic.tot?.percent || 0) + (targets.homeroom.academic.kha?.percent || 0)).toFixed(1)}%
              </span>
            </div>

            {/* Thẻ Xuất sắc xét riêng */}
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 border-2 border-purple-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-2xl shadow-sm">
                  🏆
                </div>
                <div>
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wider block">
                    DANH HIỆU HỌC SINH XUẤT SẮC (XÉT RIÊNG)
                  </span>
                  <span className="text-xs text-purple-700 font-medium">
                    Chỉ tiêu khen thưởng tính % trên tổng số {targets.homeroom?.totalStudents} học sinh toàn lớp
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-purple-950">
                  {targets.homeroom.academic.xuatSac?.count ?? 0} <span className="text-xs font-bold text-purple-700">HS</span>
                </div>
                <span className="text-xs font-black text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-lg inline-block mt-0.5">
                  {targets.homeroom.academic.xuatSac?.percent ?? 0}% toàn lớp
                </span>
              </div>
            </div>

            {/* 4 Mức Xếp loại cơ bản (100% Sĩ số) */}
            <div className="space-y-1.5">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider block">
                4 Mức Xếp Loại Học Lực Cơ Bản (Tổng = 100% Sĩ số)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "TỐT (GIỎI)", val: targets.homeroom.academic.tot, color: "from-emerald-500 to-green-600", bg: "bg-emerald-50/70 text-emerald-900 border-emerald-200" },
                  { label: "KHÁ", val: targets.homeroom.academic.kha, color: "from-blue-500 to-sky-600", bg: "bg-blue-50/70 text-blue-900 border-blue-200" },
                  { label: "ĐẠT", val: targets.homeroom.academic.dat, color: "from-amber-500 to-yellow-600", bg: "bg-amber-50/70 text-amber-900 border-amber-200" },
                  { label: "CHƯA ĐẠT", val: targets.homeroom.academic.chuaDat, color: "from-rose-500 to-red-600", bg: "bg-rose-50/70 text-rose-900 border-rose-200" },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} className={`border-2 rounded-2xl p-3.5 text-center ${bg} shadow-sm flex flex-col justify-between`}>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600">{label}</span>
                    <div className="my-1.5">
                      <span className="text-xl font-black">{val?.count ?? 0}</span>
                      <span className="text-xs font-bold text-slate-500 ml-1">HS</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${color}`}
                        style={{ width: `${Math.min(val?.percent ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black">{val?.percent ?? 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ======================================================== */}
        {/* PHẦN B: GIẢNG DẠY BỘ MÔN TOÁN                            */}
        {/* ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-sky-600 pb-2">
            <span className="bg-sky-600 text-white text-xs font-black px-2.5 py-1 rounded-md uppercase">
              PHẦN B
            </span>
            <h2 className="text-xl font-black text-slate-800">
              CHỈ TIÊU GIẢNG DẠY BỘ MÔN TOÁN (THEO TỪNG LỚP)
            </h2>
            <span className="text-xs font-semibold text-slate-500 ml-auto">
              Đánh giá theo 4 mức: <strong>TỐT, KHÁ, ĐẠT, CHƯA ĐẠT</strong> (mức cao nhất là Tốt)
            </span>
          </div>

          {/* BẢNG TỔNG HỢP BỘ MÔN TOÁN */}
          <section className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2 text-sky-300">
                  <span>📊</span> TỔNG HỢP BỘ MÔN TOÁN ({overallSub.classCount} LỚP DẠY · {overallSub.totalSubStudents} HỌC SINH)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tổng hợp mục tiêu bộ môn Toán trên toàn bộ các lớp phụ trách giảng dạy
                </p>
              </div>
              <span className="text-xs font-black bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-500/30">
                Tốt + Khá toàn khối: {overallSub.goodTotalPercent}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "TỐT", val: overallSub.tot, color: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" },
                { label: "KHÁ", val: overallSub.kha, color: "text-sky-300 bg-sky-500/20 border-sky-500/30" },
                { label: "ĐẠT", val: overallSub.dat, color: "text-amber-300 bg-amber-500/20 border-amber-500/30" },
                { label: "CHƯA ĐẠT", val: overallSub.chuaDat, color: "text-rose-300 bg-rose-500/20 border-rose-500/30" },
              ].map(({ label, val, color }) => (
                <div key={label} className={`rounded-2xl p-3.5 border text-center ${color}`}>
                  <span className="block text-xs font-black opacity-80 uppercase tracking-wider">{label}</span>
                  <span className="text-2xl font-black block my-1">
                    {val.count} <span className="text-xs font-normal opacity-70">HS</span>
                  </span>
                  <span className="text-xs font-extrabold text-white">{val.percent}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* CHI TIẾT TỪNG LỚP DẠY TOÁN */}
          <section className="space-y-3">
            {subjectClasses.map((cls, idx) => (
              <div key={cls.id || idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-black text-base text-slate-800">Lớp {cls.className}</h4>
                      <p className="text-xs text-slate-500">Môn {cls.subject || "Toán"} · Sĩ số: <strong>{cls.totalStudents}</strong> học sinh</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                    Tốt + Khá: {((cls.tot?.percent || 0) + (cls.kha?.percent || 0)).toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "TỐT", val: cls.tot, color: "from-emerald-500 to-green-600", bg: "bg-emerald-50/50 text-emerald-900 border-emerald-200" },
                    { label: "KHÁ", val: cls.kha, color: "from-blue-500 to-sky-600", bg: "bg-blue-50/50 text-blue-900 border-blue-200" },
                    { label: "ĐẠT", val: cls.dat, color: "from-amber-500 to-yellow-600", bg: "bg-amber-50/50 text-amber-900 border-amber-200" },
                    { label: "CHƯA ĐẠT", val: cls.chuaDat, color: "from-rose-500 to-red-600", bg: "bg-rose-50/50 text-rose-900 border-rose-200" },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} className={`border rounded-xl p-3 text-center ${bg} flex flex-col justify-between`}>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
                      <div className="my-1">
                        <span className="text-xl font-black">{val?.count ?? 0}</span>
                        <span className="text-[11px] font-bold text-slate-500 ml-1">HS</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${color}`}
                          style={{ width: `${Math.min(val?.percent ?? 0, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-black">{val?.percent ?? 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        {/* ======================================================== */}
        {/* PHẦN C: DANH HIỆU & PHONG TRÀO                           */}
        {/* ======================================================== */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-amber-500 pb-2">
            <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-md uppercase">
              PHẦN C
            </span>
            <h2 className="text-xl font-black text-slate-800">
              MỤC TIÊU DANH HIỆU, THI TỐT NGHIỆP & PHONG TRÀO
            </h2>
          </div>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/70">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">🏅 Danh hiệu lớp phấn đấu</span>
                <p className="text-base font-black text-slate-800">
                  {targets.otherTargets?.danhHieuLop || "Tập thể Lớp Tiên tiến Xuất sắc"}
                </p>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/70">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">🎓 Tốt nghiệp THPT</span>
                <p className="text-base font-black text-emerald-700">
                  {targets.otherTargets?.totNghiepThpt || "100%"}
                </p>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/70">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">🏛️ Tuyển sinh Đại học / Cao đẳng</span>
                <p className="text-base font-black text-indigo-700">
                  {targets.otherTargets?.daiHocCaoDang || ">= 90%"}
                </p>
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/70">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">🥇 Học sinh giỏi Trường & Tỉnh</span>
                <p className="text-base font-black text-purple-700">
                  {targets.otherTargets?.hocSinhGioi || "8 HSG trường, 2 HSG tỉnh"}
                </p>
              </div>

              {targets.otherTargets?.phongTrao ? (
                <div className="sm:col-span-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/70">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">🚩 Hoạt động phong trào & Thi đua</span>
                  <p className="text-sm font-bold text-slate-700">
                    {targets.otherTargets.phongTrao}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
