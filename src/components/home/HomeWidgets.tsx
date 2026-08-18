"use client";

import { useEffect, useMemo, useState } from "react";

import { CLASS_SITE } from "@/lib/class-site";

export function BirthdayBanner({
  students,
}: {
  students: Array<{ fullName: string; birthDay: number; birthMonth: number }>;
}) {
  const today = useMemo(() => new Date(), []);
  const names = students
    .filter((student) => student.birthDay === today.getDate() && student.birthMonth === today.getMonth() + 1)
    .map((student) => student.fullName);

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
}

export function LuckyWheel({ names }: { names: string[] }) {
  const [result, setResult] = useState("???");
  const [spinning, setSpinning] = useState(false);

  function spin() {
    if (!names.length || spinning) return;
    setSpinning(true);
    const start = performance.now();
    const duration = 4000;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      setResult(names[Math.floor(Math.random() * names.length)]);
      if (progress < 1) {
        window.setTimeout(() => requestAnimationFrame(tick), 40 + progress * 180);
        return;
      }
      setSpinning(false);
    }

    requestAnimationFrame(tick);
  }

  return (
    <div className="site-widget">
      <div style={{ fontSize: 24, fontWeight: 800, color: "#e74c3c", minHeight: 40 }}>{result}</div>
      <button className="button-primary" disabled={spinning} onClick={spin} type="button">
        {spinning ? "Đang quay..." : "Quay ngẫu nhiên"}
      </button>
    </div>
  );
}

export function ExamCountdown() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const target = new Date(`${CLASS_SITE.examDateIso}T07:30:00`);
  const diff = Math.max(target.getTime() - now.getTime(), 0);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return (
    <div>
      <div className="countdown-grid">
        <div className="countdown-card">
          <div className="countdown-value">{days}</div>
          <div>Ngày</div>
        </div>
        <div className="countdown-card">
          <div className="countdown-value">{hours}</div>
          <div>Giờ</div>
        </div>
        <div className="countdown-card">
          <div className="countdown-value">{mins}</div>
          <div>Phút</div>
        </div>
        <div className="countdown-card">
          <div className="countdown-value">{secs}</div>
          <div>Giây</div>
        </div>
      </div>
      <p style={{ textAlign: "center", color: "#64748b" }}>
        {CLASS_SITE.examTitle}: {CLASS_SITE.examDate}
      </p>
    </div>
  );
}
