"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CLASS_SITE } from "@/lib/class-site";

export const BirthdayBanner = memo(function BirthdayBanner({
  students,
}: {
  students: Array<{ fullName: string; birthDay: number; birthMonth: number }>;
}) {
  const names = useMemo(() => {
    const today = new Date();
    const d = today.getDate();
    const m = today.getMonth() + 1;
    return students
      .filter((student) => student.birthDay === d && student.birthMonth === m)
      .map((student) => student.fullName);
  }, [students]);

  if (!names.length) return null;

  return (
    <section className="site-widget" style={{ marginBottom: 24, background: "linear-gradient(135deg,#fff7ed,#ffedd5)" }}>
      <p style={{ fontSize: 22, margin: 0 }}>🎂</p>
      <p style={{ marginTop: 10, fontWeight: 700 }}>
        Chúc mừng {names.join(", ")}!
        <br />
        Sinh nhật vui vẻ và ngày càng học giỏi! 🎉
      </p>
    </section>
  );
});

export const LuckyWheel = memo(function LuckyWheel({ names }: { names: string[] }) {
  const [result, setResult] = useState("???");
  const [spinning, setSpinning] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const spin = useCallback(() => {
    if (!names.length || spinning) return;
    setSpinning(true);
    const start = performance.now();
    const duration = 3000;
    const finalName = names[Math.floor(Math.random() * names.length)];

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      // Ease-out: slow down towards end
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress < 1) {
        // Show random names while spinning, but slow down frame rate as we approach end
        setResult(names[Math.floor(Math.random() * names.length)]);
        const delay = 30 + eased * 250;
        rafRef.current = window.setTimeout(() => {
          rafRef.current = requestAnimationFrame(tick);
        }, delay) as unknown as number;
      } else {
        setResult(finalName);
        setSpinning(false);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [names, spinning]);

  if (!names.length) {
    return (
      <div className="site-widget">
        <p style={{ margin: 0 }}>Chưa có danh sách năm {CLASS_SITE.schoolYear}. Em điền sơ yếu lý lịch trước khi quay.</p>
      </div>
    );
  }

  return (
    <div className="site-widget">
      <div style={{ fontSize: 24, fontWeight: 800, color: "#e74c3c", minHeight: 40 }}>{result}</div>
      <button className="button-primary" disabled={spinning} onClick={spin} type="button">
        {spinning ? "Đang quay..." : "Quay ngẫu nhiên"}
      </button>
    </div>
  );
});

import type { Milestone } from "@/lib/academic-calendar";

/** Compact countdown bar — sits at the top of the page, DOM-only updates */
export function ExamCountdownBar({ milestones }: { milestones?: Milestone[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const hk1 = milestones?.find((m) => m.id === "hk1");
  const hk2 = milestones?.find((m) => m.id === "hk2");
  const tn = milestones?.find((m) => m.id === "tn");

  const targets = useMemo(() => [
    { iso: hk1?.iso || CLASS_SITE.examDateIso, title: hk1?.label ? `THI ${hk1.label.toUpperCase()}` : CLASS_SITE.examTitle, date: hk1?.date || CLASS_SITE.examDate },
    { iso: hk2?.iso || CLASS_SITE.hk2DateIso, title: hk2?.label ? `THI ${hk2.label.toUpperCase()}` : CLASS_SITE.hk2Title, date: hk2?.date || CLASS_SITE.hk2Date },
    { iso: tn?.iso || CLASS_SITE.tnDateIso, title: tn?.label ? `THI ${tn.label.toUpperCase()}` : CLASS_SITE.tnTitle, date: tn?.date || CLASS_SITE.tnDate },
  ], [hk1, hk2, tn]);

  useEffect(() => {
    function getActiveTarget() {
      const now = Date.now();
      for (const t of targets) {
        if (new Date(`${t.iso}T07:30:00`).getTime() > now) return t;
      }
      return targets[targets.length - 1];
    }

    function pad2(n: number) {
      return String(n).padStart(2, "0");
    }

    function update() {
      const el = containerRef.current;
      if (!el) return;
      const active = getActiveTarget();
      const target = new Date(`${active.iso}T07:30:00`).getTime();
      const diff = Math.max(target - Date.now(), 0);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      const titleEl = el.querySelector("[data-cd=title]");
      const daysEl = el.querySelector("[data-cd=d]");
      const hoursEl = el.querySelector("[data-cd=h]");
      const minsEl = el.querySelector("[data-cd=m]");
      const secsEl = el.querySelector("[data-cd=s]");
      if (titleEl) titleEl.textContent = active.title;
      if (daysEl) daysEl.textContent = String(days);
      if (hoursEl) hoursEl.textContent = pad2(hours);
      if (minsEl) minsEl.textContent = pad2(mins);
      if (secsEl) {
        secsEl.textContent = pad2(secs);
        // Restarting the animation used to read offsetWidth, which forces a
        // synchronous layout of the whole document every second. Alternating two
        // equivalent classes restarts it without touching layout.
        const useAlt = secs % 2 === 0;
        secsEl.classList.toggle("cd-tick", !useAlt);
        secsEl.classList.toggle("cd-tick-alt", useAlt);
      }
    }

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [targets]);

  const exams = [
    { label: "HK1", date: hk1?.date || CLASS_SITE.examDate },
    { label: "HK2", date: hk2?.date || CLASS_SITE.hk2Date },
    { label: "TN", date: tn?.date || CLASS_SITE.tnDate },
  ];

  return (
    <div className="cd-bar" ref={containerRef}>
      <div className="cd-bar-inner">
        <span className="cd-bar-label" data-cd="title">{targets[0]?.title || CLASS_SITE.examTitle}</span>
        <div className="cd-bar-clock">
          <span className="cd-bar-unit">
            <span className="cd-bar-num" data-cd="d">0</span>
            <span className="cd-bar-tag">ngày</span>
          </span>
          <span className="cd-bar-sep">:</span>
          <span className="cd-bar-unit">
            <span className="cd-bar-num" data-cd="h">00</span>
            <span className="cd-bar-tag">giờ</span>
          </span>
          <span className="cd-bar-sep">:</span>
          <span className="cd-bar-unit">
            <span className="cd-bar-num" data-cd="m">00</span>
            <span className="cd-bar-tag">phút</span>
          </span>
          <span className="cd-bar-sep">:</span>
          <span className="cd-bar-unit">
            <span className="cd-bar-num cd-bar-sec" data-cd="s">00</span>
            <span className="cd-bar-tag">giây</span>
          </span>
        </div>
        <div className="cd-bar-dates">
          {exams.map((e) => (
            <span key={e.label} className="cd-bar-date">{e.label}: {e.date}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

