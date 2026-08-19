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

/** Countdown only updates the DOM text, not React state, to avoid re-renders */
export function ExamCountdown() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = [
      { iso: CLASS_SITE.examDateIso, title: CLASS_SITE.examTitle, date: CLASS_SITE.examDate },
      { iso: CLASS_SITE.hk2DateIso, title: CLASS_SITE.hk2Title, date: CLASS_SITE.hk2Date },
      { iso: CLASS_SITE.tnDateIso, title: CLASS_SITE.tnTitle, date: CLASS_SITE.tnDate },
    ];

    // Find the nearest future target for countdown
    function getActiveTarget() {
      const now = Date.now();
      for (const t of targets) {
        if (new Date(`${t.iso}T07:30:00`).getTime() > now) return t;
      }
      return targets[targets.length - 1];
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

      const daysEl = el.querySelector("[data-cd=d]");
      const hoursEl = el.querySelector("[data-cd=h]");
      const minsEl = el.querySelector("[data-cd=m]");
      const secsEl = el.querySelector("[data-cd=s]");
      if (daysEl) daysEl.textContent = String(days);
      if (hoursEl) hoursEl.textContent = String(hours);
      if (minsEl) minsEl.textContent = String(mins);
      if (secsEl) secsEl.textContent = String(secs);
    }

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const info = `${CLASS_SITE.examTitle}: ${CLASS_SITE.examDate} · ${CLASS_SITE.hk2Title}: ${CLASS_SITE.hk2Date} · ${CLASS_SITE.tnTitle}: ${CLASS_SITE.tnDate}`;

  return (
    <div ref={containerRef}>
      <div className="countdown-grid">
        <div className="countdown-card">
          <div className="countdown-value" data-cd="d">0</div>
          <div>Ngày</div>
        </div>
        <div className="countdown-card">
          <div className="countdown-value" data-cd="h">0</div>
          <div>Giờ</div>
        </div>
        <div className="countdown-card">
          <div className="countdown-value" data-cd="m">0</div>
          <div>Phút</div>
        </div>
        <div className="countdown-card">
          <div className="countdown-value" data-cd="s">0</div>
          <div>Giây</div>
        </div>
      </div>
      <p style={{ textAlign: "center", color: "#64748b" }}>{info}</p>
    </div>
  );
}

