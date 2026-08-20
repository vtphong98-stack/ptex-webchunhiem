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

/**
 * Sơ đồ trang, theo thứ tự công việc của GVCN:
 *   Tuần này → Thông báo → Khu GVCN → Ban cán sự → TKB → Lịch năm → Góc học sinh
 * Trên desktop lưới tự xếp thành 2 cột nhưng thứ tự DOM không đổi, nên thứ tự
 * đọc trên điện thoại vẫn đúng ưu tiên.
 */
const ZONES = [
  { id: "tuan-nay", label: "Tuần này", icon: "📊" },
  { id: "thong-bao", label: "Thông báo", icon: "📢" },
  { id: "khu-gvcn", label: "Khu GVCN", icon: "🎓" },
  { id: "bao-cao", label: "Ban cán sự", icon: "👥" },
  { id: "tkb", label: "TKB", icon: "📅" },
  { id: "lich-nam", label: "Lịch năm", icon: "⏳" },
  { id: "goc-hoc-sinh", label: "Góc học sinh", icon: "🎒" },
];

export default async function HomePage() {
  const site = await getPublicSiteData();
  const initials = CLASS_SITE.gvcnName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(-3);

  return (
    <main className="py-3 md:py-6">
      <div className="site-shell">
        <ScrollRestore />

        <header className="site-hero">
          <p className="site-hero-kicker">Năm học {site.yearName}</p>
          <h1>
            <span className="site-hero-class">{site.className}</span>
            <span className="site-hero-sub">Lớp chủ nhiệm</span>
          </h1>
          <div className="site-hero-teacher">
            <span aria-hidden className="site-hero-avatar">
              {initials}
            </span>
            <div>
              <strong>Thầy {CLASS_SITE.gvcnName}</strong>
              <span>Giáo viên chủ nhiệm</span>
            </div>
          </div>
          <nav className="site-hero-actions" aria-label="Tác vụ đầu năm">
            <Link href={CLASS_SITE.syll as any}>📝 Khai sơ yếu lý lịch</Link>
            <a href={CLASS_SITE.careerBot} rel="noreferrer" target="_blank">
              Tư vấn hướng nghiệp
            </a>
            <a href={CLASS_SITE.careerForm} rel="noreferrer" target="_blank">
              Đăng ký học đường
            </a>
          </nav>
          <div className="site-hero-contact">
            <a className="hero-call" href={`tel:${CLASS_SITE.gvcnPhone}`}>
              Gọi GVCN
            </a>
            <a className="hero-zalo" href={`https://zalo.me/${CLASS_SITE.gvcnPhone}`} rel="noreferrer" target="_blank">
              Zalo GVCN
            </a>
          </div>
        </header>

        <div className="hp-strip">
          <ExamCountdownBar milestones={site.milestones} />
          <SchoolWeekBadge milestones={site.milestones} />
        </div>

        <BirthdayBanner students={site.students} />

        <nav aria-label="Đi tới khu vực" className="hp-nav">
          {ZONES.map((zone) => (
            <a href={`#${zone.id}`} key={zone.id}>
              <span aria-hidden>{zone.icon}</span>
              {zone.label}
            </a>
          ))}
        </nav>

        <div className="hp-grid">
          <ClassBoards board={site.board} />

          <GvcnNotices notices={site.notices} />

          <section className="site-section block-green" id="khu-gvcn">
            <h2>Khu giáo viên chủ nhiệm</h2>
            <p className="sec-note">Công cụ điều hành lớp {site.className} — chỉ tài khoản GVCN mở được.</p>
            <ul className="site-links">
              {GVCN_HOME_LINKS.map((link) => (
                // Ô setup chiếm cả hàng: grid-column phải đặt trên <li> vì <li>
                // mới là grid item, không phải thẻ <a> bên trong.
                <li className={link.className === "link-gvcn-setup" ? "tile-wide" : undefined} key={link.label}>
                  <Link className={`site-tile ${link.className}`} href={link.href as any}>
                    <span aria-hidden className="tile-icon">
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="site-section block-indigo" id="bao-cao">
            <h2>Ban cán sự nộp báo cáo</h2>
            <p className="sec-note">Mỗi chức vụ đăng nhập một lần, lần sau vào thẳng form của mình.</p>
            <ul className="site-links">
              {OFFICER_LINKS.map((link) => (
                <li key={link.code}>
                  <Link className={`site-tile ${link.className}`} href={`/login?user=${link.code}` as any}>
                    <span aria-hidden className="tile-icon">
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="site-section block-blue hp-span" id="tkb">
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
                GVCN chưa tải thời khóa biểu năm {CLASS_SITE.schoolYear}. Vào Khu GVCN → TKB, tải mẫu Excel, gõ môn rồi
                tải lên.
              </div>
            )}
          </section>

          <section className="site-section block-teal hp-span" id="lich-nam">
            <h2>Lịch năm học {site.yearName || CLASS_SITE.schoolYear}</h2>
            <p className="sec-note">Mốc đang tới được tô đậm — kéo ngang để xem cả năm.</p>
            <YearTimeline milestones={site.milestones} />
          </section>

          <section className="site-section block-sky hp-span" id="goc-hoc-sinh">
            <h2>Góc học sinh</h2>
            <div className="hp-student-grid">
              <div className="hp-sub">
                <h3>Học online</h3>
                <ul className="site-links links-plain" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
                  {LEARNING_LINKS.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} rel="noreferrer" target="_blank">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="hp-sub">
                <h3>Kỷ niệm lớp</h3>
                <div className="hp-album">
                  <div>
                    <strong>Album lớp {site.className}</strong>
                    <span>Ảnh hoạt động cả năm</span>
                  </div>
                  <a href={CLASS_SITE.album} rel="noreferrer" target="_blank">
                    Xem
                  </a>
                </div>
              </div>

              <div className="hp-sub">
                <h3>Vòng quay may mắn</h3>
                <LuckyWheel names={site.students.map((student) => student.fullName)} />
              </div>
            </div>
          </section>
        </div>

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
