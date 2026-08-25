import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/login/LoginForm";
import { OfficerDesk } from "@/components/officer/OfficerDesk";
import { isOfficerRole } from "@/lib/access";
import { isTeamReporter } from "@/lib/permissions";
import { teamRoleUsername } from "@/lib/team-roster";
import { getClassIdentity } from "@/lib/public-site";
import { getVerifiedSessionUser } from "@/lib/session";
import type { AppRole } from "@/lib/types";

export const ROLE_CONFIGS: Record<
  string,
  {
    role: AppRole;
    defaultTeam?: number;
    title: string;
    shortTitle: string;
    defaultUsername: string;
    icon: string;
    description: string;
  }
> = {
  "lop-truong": {
    role: "lopTruong",
    title: "Báo cáo Lớp trưởng (LT)",
    shortTitle: "Lớp trưởng",
    defaultUsername: "lt",
    icon: "👑",
    description: "Nhận xét tổng thể tuần qua, thông báo từ Đoàn trường/BGH và phương hướng tuần tới.",
  },
  "lt": {
    role: "lopTruong",
    title: "Báo cáo Lớp trưởng (LT)",
    shortTitle: "Lớp trưởng",
    defaultUsername: "lt",
    icon: "👑",
    description: "Nhận xét tổng thể tuần qua, thông báo từ Đoàn trường/BGH và phương hướng tuần tới.",
  },
  "hoc-tap": {
    role: "lopPhoHocTap",
    title: "Báo cáo Lớp phó Học tập (LPHT)",
    shortTitle: "Lớp phó Học tập",
    defaultUsername: "lpht",
    icon: "📚",
    description: "Báo cáo thái độ học tập, lý do, phương hướng và đề xuất nâng cao chất lượng học tập.",
  },
  "lpht": {
    role: "lopPhoHocTap",
    title: "Báo cáo Lớp phó Học tập (LPHT)",
    shortTitle: "Lớp phó Học tập",
    defaultUsername: "lpht",
    icon: "📚",
    description: "Báo cáo thái độ học tập, lý do, phương hướng và đề xuất nâng cao chất lượng học tập.",
  },
  "lao-dong": {
    role: "lopPhoLaoDong",
    title: "Báo cáo Lớp phó Lao động (LPLD)",
    shortTitle: "Lớp phó Lao động",
    defaultUsername: "lpld",
    icon: "🧹",
    description: "Xếp lịch tổ trực nhật tuần, phân công lao động và nhận xét vệ sinh lớp học.",
  },
  "lpld": {
    role: "lopPhoLaoDong",
    title: "Báo cáo Lớp phó Lao động (LPLD)",
    shortTitle: "Lớp phó Lao động",
    defaultUsername: "lpld",
    icon: "🧹",
    description: "Xếp lịch tổ trực nhật tuần, phân công lao động và nhận xét vệ sinh lớp học.",
  },
  "phong-trao": {
    role: "lopPhoPhongTrao",
    title: "Báo cáo Lớp phó Phong trào (LPPT)",
    shortTitle: "Lớp phó Phong trào",
    defaultUsername: "lppt",
    icon: "🚩",
    description: "Theo dõi phong trào thi đua, văn nghệ, thể thao và phân công học sinh tham gia.",
  },
  "lppt": {
    role: "lopPhoPhongTrao",
    title: "Báo cáo Lớp phó Phong trào (LPPT)",
    shortTitle: "Lớp phó Phong trào",
    defaultUsername: "lppt",
    icon: "🚩",
    description: "Theo dõi phong trào thi đua, văn nghệ, thể thao và phân công học sinh tham gia.",
  },
  "trat-tu": {
    role: "lopPhoTratTu",
    title: "Báo cáo Lớp phó Trật tự (LPTT)",
    shortTitle: "Lớp phó Trật tự",
    defaultUsername: "lptt",
    icon: "🛡️",
    description: "Theo dõi nề nếp, trật tự, tác phong học sinh và các vấn đề an ninh mạng xã hội.",
  },
  "lptt": {
    role: "lopPhoTratTu",
    title: "Báo cáo Lớp phó Trật tự (LPTT)",
    shortTitle: "Lớp phó Trật tự",
    defaultUsername: "lptt",
    icon: "🛡️",
    description: "Theo dõi nề nếp, trật tự, tác phong học sinh và các vấn đề an ninh mạng xã hội.",
  },
  "to-truong": {
    role: "toTruong",
    defaultTeam: 1,
    title: "Báo cáo Tổ trưởng (Tổ 1 – Tổ 4)",
    shortTitle: "Tổ trưởng",
    defaultUsername: "tt1",
    icon: "👥",
    description: "Chấm điểm thi đua từng học sinh trong tổ: bài tập, trật tự, đi trễ, vi phạm, phát biểu.",
  },
  "tt": {
    role: "toTruong",
    defaultTeam: 1,
    title: "Báo cáo Tổ trưởng (Tổ 1 – Tổ 4)",
    shortTitle: "Tổ trưởng",
    defaultUsername: "tt1",
    icon: "👥",
    description: "Chấm điểm thi đua từng học sinh trong tổ: bài tập, trật tự, đi trễ, vi phạm, phát biểu.",
  },
  "tt1": {
    role: "toTruong",
    defaultTeam: 1,
    title: "Báo cáo Tổ trưởng Tổ 1",
    shortTitle: "Tổ trưởng 1",
    defaultUsername: "tt1",
    icon: "👥",
    description: "Chấm điểm thi đua học sinh Tổ 1.",
  },
  "tt2": {
    role: "toTruong",
    defaultTeam: 2,
    title: "Báo cáo Tổ trưởng Tổ 2",
    shortTitle: "Tổ trưởng 2",
    defaultUsername: "tt2",
    icon: "👥",
    description: "Chấm điểm thi đua học sinh Tổ 2.",
  },
  "tt3": {
    role: "toTruong",
    defaultTeam: 3,
    title: "Báo cáo Tổ trưởng Tổ 3",
    shortTitle: "Tổ trưởng 3",
    defaultUsername: "tt3",
    icon: "👥",
    description: "Chấm điểm thi đua học sinh Tổ 3.",
  },
  "tt4": {
    role: "toTruong",
    defaultTeam: 4,
    title: "Báo cáo Tổ trưởng Tổ 4",
    shortTitle: "Tổ trưởng 4",
    defaultUsername: "tt4",
    icon: "👥",
    description: "Chấm điểm thi đua học sinh Tổ 4.",
  },
  "to-pho": {
    role: "toPho",
    defaultTeam: 1,
    title: "Báo cáo Tổ phó (Tổ 1 – Tổ 4)",
    shortTitle: "Tổ phó",
    defaultUsername: "tp1",
    icon: "🤝",
    description: "Phụ tổ trưởng chấm điểm thi đua từng học sinh trong tổ.",
  },
  ...Object.fromEntries(
    [1, 2, 3, 4].map((team) => [
      `tp${team}`,
      {
        role: "toPho" as AppRole,
        defaultTeam: team,
        title: `Báo cáo Tổ phó Tổ ${team}`,
        shortTitle: `Tổ phó ${team}`,
        defaultUsername: `tp${team}`,
        icon: "🤝",
        description: `Phụ tổ trưởng chấm điểm thi đua học sinh Tổ ${team}.`,
      },
    ]),
  ),
  "thu-quy": {
    role: "thuQuy",
    title: "Báo cáo Thủ quỹ lớp",
    shortTitle: "Thủ quỹ",
    defaultUsername: "thuquy",
    icon: "💰",
    description: "Thu chi quỹ lớp, danh sách đóng quỹ, tiền thưởng và số dư tồn quỹ theo tuần.",
  },
  "thuquy": {
    role: "thuQuy",
    title: "Báo cáo Thủ quỹ lớp",
    shortTitle: "Thủ quỹ",
    defaultUsername: "thuquy",
    icon: "💰",
    description: "Thu chi quỹ lớp, danh sách đóng quỹ, tiền thưởng và số dư tồn quỹ theo tuần.",
  },
};

export default async function OfficerReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { role: roleSlug } = await params;
  const { team: teamQuery } = await searchParams;

  const config = ROLE_CONFIGS[roleSlug.toLowerCase()];
  if (!config) {
    notFound();
  }

  // Tên lấy từ tài khoản đang sống chứ không lấy trong token: GVCN vừa bổ nhiệm
  // là em đăng nhập thấy tên mình ngay.
  const session = await getVerifiedSessionUser();
  const site = await getClassIdentity();

  // The reporting area belongs to the class officers only. The teacher reviews
  // every submitted report read-only from the setup desk and /tong-ket.
  const isAuthorized = Boolean(session && isOfficerRole(session.role) && session.role === config.role);

  // A tổ trưởng always reports for their own tổ; ?team= must not move them. Only
  // the tổ selector inside the teacher desk may pick another one.
  let teamNumber = config.defaultTeam ?? null;
  if (isTeamReporter(config.role)) {
    if (session && isTeamReporter(session.role) && session.teamNumber) {
      teamNumber = session.teamNumber;
    } else {
      const qTeam = parseInt(teamQuery || "");
      teamNumber = qTeam >= 1 && qTeam <= 4 ? qTeam : config.defaultTeam ?? 1;
    }
  }

  if (isAuthorized && session) {
    return (
      <main className="py-4 md:py-6">
        <div className="site-shell mb-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <span className="pl-2 text-xs font-bold text-slate-500">{config.title}</span>
            <Link
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              href="/"
            >
              Trang chủ
            </Link>
          </div>
        </div>

        <OfficerDesk fullName={session.fullName} role={session.role} teamNumber={teamNumber} />
      </main>
    );
  }

  // Not signed in, or signed in as somebody else -> offer this role's login box
  // right here, preselected, so one password entry is all it takes.
  const targetUsername = teamNumber
    ? teamRoleUsername(config.role === "toPho" ? "toPho" : "toTruong", teamNumber) || config.defaultUsername
    : config.defaultUsername;
  const nextPath = teamNumber && isTeamReporter(config.role)
    ? `/bao-cao/${roleSlug}?team=${teamNumber}`
    : `/bao-cao/${roleSlug}`;
  const signedInAs = session ? `${session.fullName} (${session.username})` : "";
  // Crossing areas only when a teacher account is the one signed in.
  const crossingArea = Boolean(session && !isOfficerRole(session.role));

  return (
    <main className="py-8">
      <div className="site-shell max-w-md mx-auto">
        <div className="mb-4 text-center">
          <span className="text-4xl">{config.icon}</span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{config.title}</h1>
          <p className="mt-1 text-xs text-slate-500">{config.description}</p>
        </div>

        <Suspense
          fallback={
            <div className="officer-form text-center p-8 text-slate-500">
              Đang tải form đăng nhập...
            </div>
          }
        >
          <LoginForm
            nextOverride={nextPath}
            siteName={site.fullName}
            signedInAs={signedInAs}
            switchingArea={crossingArea}
            userKeyOverride={targetUsername}
          />
        </Suspense>

        <div className="mt-4 text-center">
          <Link
            className="text-xs text-slate-500 hover:text-slate-800 underline"
            href="/"
          >
            ← Quay lại Trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
