import { ContactDirectory } from "@/components/contact/ContactDirectory";
import { CLASS_SITE } from "@/lib/class-site";
import { telHref, zaloHref } from "@/lib/phone";
import { getContactDirectory } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Liên hệ phụ huynh · ${CLASS_SITE.fullName}`,
};

export default async function ParentContactPage() {
  const directory = await getContactDirectory("parents");

  return (
    <main className="contact-page">
      <div className="contact-shell">
        <p className="contact-back">
          <a href="/">← Trang chủ</a>
        </p>
        <header className="contact-hero">
          <h1>Liên hệ phụ huynh</h1>
          <p>
            {CLASS_SITE.fullName} · GVCN {CLASS_SITE.gvcnName}
          </p>
        </header>
        <div className="contact-gvcn">
          <a className="contact-call" href={telHref(CLASS_SITE.gvcnPhone)}>
            Gọi GVCN
          </a>
          <a className="contact-zalo" href={zaloHref(CLASS_SITE.gvcnPhone)} rel="noreferrer" target="_blank">
            Zalo GVCN
          </a>
        </div>
        <ContactDirectory
          emptyHint="Chưa có số phụ huynh. Học sinh điền sơ yếu lý lịch để hiện danh sách gọi nhanh."
          items={directory.items}
          kind="parents"
        />
      </div>
    </main>
  );
}
