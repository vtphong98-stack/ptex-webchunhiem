import { BirthdayBanner, ExamCountdown, HomeRanking, LuckyWheel } from "@/components/home/HomeWidgets";
import { GvcnNotices } from "@/components/home/GvcnNotices";
import { Timetable } from "@/components/home/Timetable";
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
          <h1>{CLASS_SITE.fullName}</h1>
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

        <section className="site-section">
          <h2>Sơ yếu lý lịch đầu năm</h2>
          <div className="syll-home">
            <p>
              Năm học {CLASS_SITE.schoolYear} bắt đầu từ sơ yếu lý lịch. Mỗi em điền một lần — dữ liệu vào MongoDB
              (toàn web: liên hệ, tra cứu, ban cán sự) và Google Sheet lớp.
            </p>
            <a className="button-primary" href="/syll">
              Điền sơ yếu lý lịch
            </a>
          </div>
        </section>

        <BirthdayBanner students={site.students} />

        <section className="site-section">
          <h2>Mốc thời gian năm học {CLASS_SITE.schoolYear}</h2>
          <YearTimeline />
        </section>

        <section className="site-section">
          <h2>Thời khóa biểu</h2>
          <ExamCountdown />
          {site.hasTimetable ? (
            <Timetable afternoon={site.timetable.afternoon} morning={site.timetable.morning} />
          ) : (
            <div className="site-widget">
              <p style={{ margin: 0 }}>
                GVCN chưa tải thời khóa biểu năm {CLASS_SITE.schoolYear}. Vào trang GVCN → TKB, tải mẫu Excel, gõ môn, rồi
                tải lên.
              </p>
            </div>
          )}
        </section>

        <HomeRanking />

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
          <h2>Ban cán sự lớp báo cáo</h2>
          <ul className="site-links">
            {OFFICER_LINKS.map((link) => (
              <li key={link.code}>
                <a href={`/login?user=${link.code}`}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-section">
          <h2>Giáo viên chủ nhiệm</h2>
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

        <section className="site-section">
          <h2>Vòng quay may mắn</h2>
          <LuckyWheel names={site.students.map((student) => student.fullName)} />
        </section>
      </div>
    </main>
  );
}
