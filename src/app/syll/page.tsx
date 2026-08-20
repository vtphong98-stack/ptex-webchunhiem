import Link from "next/link";

import { SyllForm } from "@/components/syll/SyllForm";
import { CLASS_SITE } from "@/lib/class-site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Sơ yếu lý lịch · ${CLASS_SITE.fullName}`,
};

export default function SyllPage() {
  return (
    <main className="syll-page">
      <div className="syll-card">
        <p className="syll-kicker">
          <Link href="/">← Trang chủ</Link>
        </p>
        <h1>Sơ yếu lý lịch</h1>
        <p className="syll-sub">
          {CLASS_SITE.fullName} · GVCN Thầy {CLASS_SITE.gvcnName}
        </p>
        <SyllForm />
      </div>
    </main>
  );
}
