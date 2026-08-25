import type { PublicNotice } from "@/lib/notices";

/** Trang chủ chỉ để ba tin đầu; còn lại nằm sau nút "Xem thêm". */
const HOME_LIMIT = 3;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "GV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function NoticeCard({ notice }: { notice: PublicNotice }) {
  return (
    <article className={`gvcn-notice${notice.pinned ? " is-pinned" : ""}${notice.isNew ? " is-new" : ""}`}>
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
  );
}

export function GvcnNotices({ notices }: { notices: PublicNotice[] }) {
  // Danh sách đã xếp sẵn: tin ghim lên trước, rồi mới nhất trước.
  const shown = notices.slice(0, HOME_LIMIT);
  const rest = notices.slice(HOME_LIMIT);

  return (
    <section className="site-section block-violet" id="thong-bao">
      <h2>Thông báo từ GVCN</h2>
      {!notices.length ? (
        <div className="gvcn-notice-empty">Chưa có thông báo mới.</div>
      ) : (
        <>
          <div className="gvcn-notice-list">
            {shown.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
          </div>

          {/* Dùng <details> chứ không phải nút có trạng thái: trang chủ dựng sẵn
              ở máy chủ, để trình duyệt tự đóng mở thì không phải gửi thêm mã
              chạy xuống máy học sinh. */}
          {rest.length ? (
            <details className="gvcn-notice-more">
              <summary>
                <span className="when-closed">Xem thêm {rest.length} thông báo cũ</span>
                <span className="when-open">Thu gọn</span>
              </summary>
              <div className="gvcn-notice-list">
                {rest.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
