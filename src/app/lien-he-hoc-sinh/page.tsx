import Link from "next/link";

import { ContactDirectory } from "@/components/contact/ContactDirectory";
import { getContactDirectory } from "@/lib/public-site";
import { getClassIdentity } from "@/lib/public-site";

export const revalidate = 60;

export async function generateMetadata() {
  const site = await getClassIdentity();
  return { title: `Liên hệ học sinh · ${site.fullName}` };
}

export default async function StudentContactPage() {
  const site = await getClassIdentity();
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
            {site.fullName} · GVCN {site.gvcnName}
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
