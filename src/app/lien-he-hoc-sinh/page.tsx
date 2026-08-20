import Link from "next/link";

import { ContactDirectory } from "@/components/contact/ContactDirectory";
import { CLASS_SITE } from "@/lib/class-site";
import { getContactDirectory } from "@/lib/public-site";

export const revalidate = 60;

export const metadata = {
  title: `Liên hệ học sinh · ${CLASS_SITE.fullName}`,
};

export default async function StudentContactPage() {
  const directory = await getContactDirectory("students");

  return (
    <main className="contact-page">
      <div className="contact-shell">
        <p className="contact-back">
          <Link href="/">← Trang chủ</Link>
        </p>
        <header className="contact-hero">
          <h1>Liên hệ học sinh</h1>
          <p>
            {CLASS_SITE.fullName} · GVCN {CLASS_SITE.gvcnName}
          </p>
        </header>
        <ContactDirectory
          emptyHint="Chưa có SĐT học sinh. Em điền sơ yếu lý lịch để GVCN và lớp liên hệ nhanh."
          items={directory.items}
          kind="students"
        />
      </div>
    </main>
  );
}
