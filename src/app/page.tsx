import { BirthdayBanner, ExamCountdown, LuckyWheel } from "@/components/home/HomeWidgets";
import { ClassBoards } from "@/components/home/ClassBoards";
import { GvcnNotices } from "@/components/home/GvcnNotices";
import { TimetablePanel } from "@/components/home/TimetablePanel";
import { YearTimeline } from "@/components/home/YearTimeline";
import { CLASS_SITE, LEARNING_LINKS, OFFICER_LINKS } from "@/lib/class-site";
import { getPublicSiteData } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const site = await getPublicSiteData();

  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <header className="site-header">
          <h1>{site.fullName}</h1>
          <p className="site-gvcn">GVCN: {CLASS_SITE.gvcnName}</p>
          <div className="site-actions">
            <a className="site-chip" href={CLASS_SITE.syll}>
              Sơ yếu lý lịch
            </a>
            <a className="site-chip" href={CLASS_SITE.careerBot} rel="noreferrer" target="_blank">
              Bot Tư vấn hướng nghiệp
            </a>
            <a className="site-chip" href={CLASS_SITE.careerForm} rel="noreferrer" target="_blank">
              Đăng ký tư vấn học đường
            </a>
          </div>
          <div className="site-contact" style={{ marginTop: 14 }}>
            <a href={`tel:${CLASS_SITE.gvcnPhone}`}>Gọi Điện</a>
            <a href={`https://zalo.me/${CLASS_SITE.gvcnPhone}`} rel="noreferrer" target="_blank">
              Liên hệ Zalo
            </a>
          </div>
        </header>

        <GvcnNotices notices={site.notices} />

        <ClassBoards board={site.board} />

        <BirthdayBanner students={site.students} />

        <section className="site-section block-teal">
          <h2>Mốc thời gian năm học {CLASS_SITE.schoolYear}</h2>
          <YearTimeline />
        </section>

        <section className="site-section block-blue">
          <h2>Thời khóa biểu</h2>
          <ExamCountdown />
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
                <a href={`/login?user=${link.code}`}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-section block-green">
          <h2>Giáo viên chủ nhiệm · Lớp {site.className}</h2>
          <ul className="site-links">
            <li>
              <a href="/login?user=gvcn">Thông báo GVCN</a>
            </li>
            <li>
              <a href="/login?user=gvcn">Tổng kết lớp theo tuần</a>
            </li>
            <li>
              <a href="/login?user=gvcn">Dữ liệu lớp · tra cứu HS</a>
            </li>
            <li>
              <a href="/lien-he-phu-huynh">Liên hệ nhanh phụ huynh</a>
            </li>
            <li>
              <a href="/lien-he-hoc-sinh">Liên hệ nhanh học sinh</a>
            </li>
            <li>
              <a href="/syll">Sơ yếu lý lịch học sinh</a>
            </li>
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
