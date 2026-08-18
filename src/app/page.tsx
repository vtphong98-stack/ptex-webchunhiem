import { BirthdayBanner, ExamCountdown, HomeRanking, LuckyWheel } from "@/components/home/HomeWidgets";
import { Timetable } from "@/components/home/Timetable";
import { CLASS_SITE, CLASS_STUDENTS, LEARNING_LINKS, OFFICER_LINKS } from "@/lib/class-site";

export default function HomePage() {
  return (
    <main className="py-4 md:py-8">
      <div className="site-shell">
        <header className="site-header">
          <h1>{CLASS_SITE.fullName}</h1>
          <p className="site-gvcn">GVCN: {CLASS_SITE.gvcnName}</p>
          <div className="site-actions">
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

        <BirthdayBanner students={CLASS_STUDENTS} />

        <section className="site-section">
          <h2>Vòng quay may mắn</h2>
          <LuckyWheel names={CLASS_STUDENTS.map((student) => student.fullName)} />
        </section>

        <section className="site-section">
          <h2>Thời khóa biểu</h2>
          <ExamCountdown />
          <Timetable />
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
                <a href={`/login?user=${link.code}`}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>

        <section className="site-section">
          <h2>Giáo viên chủ nhiệm</h2>
          <ul className="site-links">
            <li>
              <a href="/login?user=gvcn">Tổng kết lớp theo tuần</a>
            </li>
            <li>
              <a href="/login?user=gvcn">Dữ liệu lớp</a>
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
