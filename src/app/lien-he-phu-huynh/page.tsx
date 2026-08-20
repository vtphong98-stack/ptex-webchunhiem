import Link from "next/link";

import { ContactDirectory } from "@/components/contact/ContactDirectory";
import { CLASS_SITE } from "@/lib/class-site";
import { telHref, zaloHref } from "@/lib/phone";
import { getContactDirectory } from "@/lib/public-site";
import { getClassIdentity } from "@/lib/public-site";

export const revalidate = 60;

export async function generateMetadata() {
  const site = await getClassIdentity();
  return { title: `Liên hệ phụ huynh · ${site.fullName}` };
}

export default async function ParentContactPage() {
  const site = await getClassIdentity();
  const directory = await getContactDirectory("parents");

  return (
    <main className="contact-page">
      <div className="contact-shell">
        <p className="contact-back">
          <Link href="/">← Trang chủ</Link>
        </p>
        <header className="contact-hero">
          <h1>Liên hệ phụ huynh</h1>
          <p>
            {site.fullName} · GVCN {site.gvcnName}
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
