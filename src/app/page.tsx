import Link from "next/link";

import { BirthdayBanner, ExamCountdown, LuckyWheel } from "@/components/home/HomeWidgets";
import { Timetable } from "@/components/home/Timetable";
import { CLASS_SITE, LEARNING_LINKS, OFFICER_LINKS } from "@/lib/class-site";
import { getHomePageData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { classConfig, schoolYear, students } = await getHomePageData();
  const title = classConfig?.fullName || schoolYear?.label || CLASS_SITE.fullName;
  const gvcn = classConfig?.gvcnDisplayName || CLASS_SITE.gvcnName;
  const phone = classConfig?.gvcnPhone || CLASS_SITE.gvcnPhone;

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <header className="site-header">
          <h1>{title}</h1>
          <p className="site-gvcn">GVCN: {gvcn}</p>
          <div className="site-actions">
            <a className="site-chip" href={CLASS_SITE.careerBot} rel="noreferrer" target="_blank">
              Bot Tư vấn hướng nghiệp
            </a>
            <a className="site-chip" href={CLASS_SITE.careerForm} rel="noreferrer" target="_blank">
              Đăng ký tư vấn học đường
            </a>
          </div>
          <div className="site-contact" style={{ marginTop: 14 }}>
            <a href={`tel:${phone}`}>Gọi Điện</a>
            <a href={`https://zalo.me/${phone}`} rel="noreferrer" target="_blank">
              Liên hệ Zalo
            </a>
          </div>
        </header>

        <BirthdayBanner
          students={students.map((student) => ({
            fullName: student.fullName,
            birthDay: student.birthDay,
            birthMonth: student.birthMonth,
          }))}
        />

        <section className="site-section">
          <h2>Vòng quay may mắn</h2>
          <LuckyWheel names={students.map((student) => student.fullName)} />
        </section>

        <section className="site-section">
          <h2>Thời khóa biểu</h2>
          <ExamCountdown />
          <Timetable />
        </section>

        <section className="site-section">
          <h2>Học online và Roboki AI cho học sinh</h2>
          <ul className="site-links">
            {LEARNING_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} rel="noreferrer" target="_blank">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-section">
          <h2>Kỷ niệm lớp 12C1</h2>
          <div className="site-widget" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>Album lớp</strong>
            <a className="button-primary" href={CLASS_SITE.album} rel="noreferrer" target="_blank">
              Xem album
            </a>
          </div>
        </section>

        <section className="site-section">
          <h2>Cập nhật SYLL đầu năm</h2>
          <ul className="site-links">
            <li>
              <a href={CLASS_SITE.syll} rel="noreferrer" target="_blank">
                Sơ yếu lý lịch
              </a>
            </li>
          </ul>
        </section>

        <section className="site-section">
          <h2>Ban cán sự lớp báo cáo</h2>
          <ul className="site-links">
            {OFFICER_LINKS.map((link) => (
              <li key={link.code}>
                <Link href={{ pathname: "/login", query: { user: link.code } }}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-section">
          <h2>Giáo viên chủ nhiệm</h2>
          <ul className="site-links">
            <li>
              <Link href={{ pathname: "/login", query: { user: "gvcn" } }}>Tổng kết lớp theo tuần</Link>
            </li>
            <li>
              <Link href={{ pathname: "/login", query: { user: "gvcn" } }}>Dữ liệu lớp</Link>
            </li>
            <li>
              <a href={CLASS_SITE.parents} rel="noreferrer" target="_blank">
                Liên hệ nhanh phụ huynh
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
