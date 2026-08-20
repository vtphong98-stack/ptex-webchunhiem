import Link from "next/link";

import { SyllForm } from "@/components/syll/SyllForm";
import { getClassIdentity } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const site = await getClassIdentity();
  return { title: `Sơ yếu lý lịch · ${site.fullName}` };
}

export default async function SyllPage() {
  const site = await getClassIdentity();
  return (
    <main className="syll-page">
      <div className="syll-card">
        <p className="syll-kicker">
          <Link href="/">← Trang chủ</Link>
        </p>
        <h1>Sơ yếu lý lịch</h1>
        <p className="syll-sub">
          {site.fullName} · GVCN {site.gvcnDisplayName}
        </p>
        <SyllForm siteName={site.fullName} />
      </div>
    </main>
  );
}
