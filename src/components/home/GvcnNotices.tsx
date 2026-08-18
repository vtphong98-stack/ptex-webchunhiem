import type { PublicNotice } from "@/lib/notices";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "GV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function GvcnNotices({ notices }: { notices: PublicNotice[] }) {
  return (
    <section className="site-section">
      <h2>Thông báo từ giáo viên chủ nhiệm</h2>
      {!notices.length ? (
        <div className="gvcn-notice-empty">Chưa có thông báo mới.</div>
      ) : (
        <div className="gvcn-notice-list">
          {notices.map((notice) => (
            <article
              className={`gvcn-notice${notice.pinned ? " is-pinned" : ""}${notice.isNew ? " is-new" : ""}`}
              key={notice.id}
            >
              <div className="gvcn-notice-top">
                {notice.isNew ? <span className="gvcn-notice-new">NEW</span> : null}
                {notice.pinned ? <span className="gvcn-notice-pin">Ghim</span> : null}
                <time>{notice.dateLabel}</time>
              </div>
              <p className="gvcn-notice-kicker">Tiêu đề</p>
              <h3 className="gvcn-notice-title">{notice.title}</h3>
              <div className="gvcn-notice-body">
                <p className="gvcn-notice-kicker">Nội dung</p>
                <p className="gvcn-notice-text">{notice.body}</p>
              </div>
              <footer className="gvcn-notice-author">
                <span className="gvcn-notice-avatar" aria-hidden>
                  {initials(notice.authorName)}
                </span>
                <div>
                  <strong>{notice.authorName}</strong>
                  <span>Người đăng · Giáo viên chủ nhiệm</span>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
