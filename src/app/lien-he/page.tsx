import Link from "next/link";

import { ContactDirectoryTabs } from "@/components/contact/ContactDirectoryTabs";
import { requireGvcn } from "@/lib/access";
import { CLASS_SITE } from "@/lib/class-site";
import { telHref, zaloHref } from "@/lib/phone";
import { getBothContactDirectories } from "@/lib/public-site";
import { getClassIdentity } from "@/lib/public-site";

export const revalidate = 60;

export async function generateMetadata() {
  const site = await getClassIdentity();
  return {
    title: `Liên hệ nhanh · ${site.fullName}`,
    description: `Liên hệ phụ huynh và học sinh lớp ${site.className}`,
  };
}

export default async function LienHePage() {
  const site = await getClassIdentity();
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
          <p>{site.fullName} · GVCN {site.gvcnDisplayName}</p>
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
