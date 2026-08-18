import type { PublicNotice } from "@/lib/notices";

export function GvcnNotices({ notices }: { notices: PublicNotice[] }) {
  return (
    <section className="site-section">
      <h2>Thông báo từ giáo viên chủ nhiệm</h2>
      {!notices.length ? (
        <div className="gvcn-notice-empty">Chưa có thông báo mới.</div>
      ) : (
        <div className="gvcn-notice-list">
          {notices.map((notice) => (
            <article className={`gvcn-notice${notice.pinned ? " is-pinned" : ""}`} key={notice.id}>
              <div className="gvcn-notice-top">
                {notice.isNew ? <span className="gvcn-notice-new">NEW</span> : null}
                {notice.pinned ? <span className="gvcn-notice-pin">Ghim</span> : null}
                <time>{notice.dateLabel}</time>
              </div>
              <h3>{notice.title}</h3>
              <p>{notice.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
