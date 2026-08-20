import Link from "next/link";

import { BirthdayBanner, ExamCountdownBar, LuckyWheel } from "@/components/home/HomeWidgets";
import { ClassBoards } from "@/components/home/ClassBoards";
import { GvcnNotices } from "@/components/home/GvcnNotices";
import { TimetablePanel } from "@/components/home/TimetablePanel";
import { SchoolWeekBadge } from "@/components/home/SchoolWeekBadge";
import { ScrollRestore } from "@/components/home/ScrollRestore";
import { YearTimeline } from "@/components/home/YearTimeline";
import { CLASS_SITE, GVCN_HOME_LINKS, LEARNING_LINKS, OFFICER_LINKS } from "@/lib/class-site";
import { getPublicSiteData } from "@/lib/public-site";

export const revalidate = 30;

export default async function HomePage() {
  const site = await getPublicSiteData();

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <ScrollRestore />
        <ExamCountdownBar milestones={site.milestones} />
        <SchoolWeekBadge milestones={site.milestones} />
        <header className="site-hero">
          <p className="site-hero-kicker">Năm học {site.yearName}</p>
          <h1>
            <span className="site-hero-class">{site.className}</span>
            <span className="site-hero-sub">Lớp chủ nhiệm</span>
          </h1>
          <div className="site-hero-teacher">
            <span aria-hidden className="site-hero-avatar">
              {CLASS_SITE.gvcnName
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(-3)}
            </span>
            <div>
              <strong>Thầy {CLASS_SITE.gvcnName}</strong>
              <span>Giáo viên chủ nhiệm</span>
            </div>
          </div>
          <nav className="site-hero-actions" aria-label="Tác vụ đầu năm">
            <Link href={CLASS_SITE.syll as any}>Sơ yếu lý lịch</Link>
            <a href={CLASS_SITE.careerBot} rel="noreferrer" target="_blank">
              Tư vấn hướng nghiệp
            </a>
            <a href={CLASS_SITE.careerForm} rel="noreferrer" target="_blank">
              Đăng ký học đường
            </a>
          </nav>
          <div className="site-hero-contact">
            <a className="hero-call" href={`tel:${CLASS_SITE.gvcnPhone}`}>
              Gọi điện
            </a>
            <a className="hero-zalo" href={`https://zalo.me/${CLASS_SITE.gvcnPhone}`} rel="noreferrer" target="_blank">
              Zalo GVCN
            </a>
          </div>
        </header>

        <GvcnNotices notices={site.notices} />

        <ClassBoards board={site.board} />

        <BirthdayBanner students={site.students} />

        <section className="site-section block-teal">
          <h2>Mốc thời gian năm học {site.yearName || CLASS_SITE.schoolYear}</h2>
          <YearTimeline milestones={site.milestones} />
        </section>

        <section className="site-section block-blue">
          <h2>Thời khóa biểu</h2>
          {site.hasTimetable ? (
            <TimetablePanel
              current={{
                id: "current",
                createdAt: site.timetableUpdatedAt,
                current: true,
                morning: site.timetable.morning,
                afternoon: site.timetable.afternoon,
              }}
              versions={site.timetableVersions}
            />
          ) : (
            <div className="site-widget">
              <p style={{ margin: 0 }}>
                GVCN chưa tải thời khóa biểu năm {CLASS_SITE.schoolYear}. Vào trang GVCN → TKB, tải mẫu Excel, gõ môn, rồi
                tải lên.
              </p>
            </div>
          )}
        </section>

        <section className="site-section block-sky">
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

        <section className="site-section block-pink">
          <h2>Kỷ niệm lớp {site.className}</h2>
          <div className="site-widget" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>Album lớp</strong>
            <a className="button-primary" href={CLASS_SITE.album} rel="noreferrer" target="_blank">
              Xem album
            </a>
          </div>
        </section>

        <section className="site-section block-indigo">
          <h2>Ban cán sự lớp báo cáo</h2>
          <ul className="site-links">
            {OFFICER_LINKS.map((link) => (
              <li key={link.code}>
                <Link className={`site-tile ${link.className}`} href={`/login?user=${link.code}` as any}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-section block-green">
          <h2>Giáo viên chủ nhiệm · Lớp {site.className}</h2>
          <ul className="site-links">
            {GVCN_HOME_LINKS.map((link) => (
              <li key={link.label}>
                <Link className={`site-tile ${link.className}`} href={link.href as any}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-section block-orange">
          <h2>Vòng quay may mắn</h2>
          <LuckyWheel names={site.students.map((student) => student.fullName)} />
        </section>

        <footer className="site-copyright">
          <p>
            © {new Date().getFullYear()} {site.fullName} · GVCN Thầy {CLASS_SITE.gvcnName}
          </p>
          <p>Web báo cáo chủ nhiệm · Mọi quyền được bảo lưu.</p>
        </footer>
      </div>
    </main>
  );
}
