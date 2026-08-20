import Link from "next/link";

import { ContactDirectoryTabs } from "@/components/contact/ContactDirectoryTabs";
import { requireGvcn } from "@/lib/access";
import { CLASS_SITE } from "@/lib/class-site";
import { telHref, zaloHref } from "@/lib/phone";
import { getBothContactDirectories } from "@/lib/public-site";

export const revalidate = 60;

export const metadata = {
  title: `Liên hệ nhanh · ${CLASS_SITE.fullName}`,
  description: "Liên hệ phụ huynh và học sinh lớp " + CLASS_SITE.className,
};

export default async function LienHePage() {
  await requireGvcn("/lien-he");

  const { parents, students } = await getBothContactDirectories();

  return (
    <main className="contact-page">
      <div className="contact-shell">
        <p className="contact-back">
          <Link href="/">← Trang chủ</Link>
        </p>
        <header className="contact-hero">
          <h1>Liên Hệ Nhanh</h1>
          <p>{CLASS_SITE.fullName} · GVCN Thầy {CLASS_SITE.gvcnName}</p>
        </header>
        <div className="contact-gvcn">
          <a className="contact-call" href={telHref(CLASS_SITE.gvcnPhone)}>
            Gọi GVCN
          </a>
          <a className="contact-zalo" href={zaloHref(CLASS_SITE.gvcnPhone)} rel="noreferrer" target="_blank">
            Zalo GVCN
          </a>
        </div>

        <ContactDirectoryTabs
          parents={parents}
          students={students}
        />
      </div>
    </main>
  );
}
