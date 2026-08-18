import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  GraduationCap,
  Phone,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

import {
  logoutAction,
  saveParentAction,
  saveReportAction,
  saveSchoolYearAction,
  saveStudentAction,
  saveUserAction,
  setCurrentSchoolYearAction,
} from "@/app/dashboard/actions";
import { getDashboardData } from "@/lib/data";
import {
  canManageAccounts,
  canManageParents,
  canManageSchoolYears,
  canManageStudents,
  canReviewReports,
  getAllowedViews,
} from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import type { AppRole, NavView } from "@/lib/types";
import { APP_ROLES } from "@/lib/types";
import { formatDate, formatRoleLabel } from "@/lib/utils";

const navLabels: Record<NavView, string> = {
  overview: "Tổng quan",
  students: "Học sinh",
  parents: "Phụ huynh",
  reports: "Báo cáo",
  "school-years": "Năm học",
  accounts: "Tài khoản",
  audit: "Lịch sử",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const data = await getDashboardData(params.year);
  const allowedViews = getAllowedViews(session.role);
  const currentView = (allowedViews.includes(params.view as NavView) ? params.view : allowedViews[0]) as NavView;

  const reportItems =
    session.role === "toTruong" && session.teamNumber
      ? data.reports.filter((report) => report.teamNumber === session.teamNumber || report.reporterRole === "gvcn")
      : data.reports;

  const groupedStudents = new Map<number | null, typeof data.students>();
  for (const student of data.students) {
    const key = student.teamNumber;
    const bucket = groupedStudents.get(key) ?? [];
    bucket.push(student);
    groupedStudents.set(key, bucket);
  }

  return (
    <main className="container py-4 md:py-6">
      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card h-fit p-4 md:sticky md:top-4">
          <div className="rounded-3xl bg-slate-950 p-4 text-slate-50">
            <p className="text-sm text-blue-200">Đang đăng nhập</p>
            <h1 className="mt-1 text-xl font-semibold">{session.fullName}</h1>
            <p className="mt-1 text-sm text-slate-300">{formatRoleLabel(session.role)}</p>
            {session.teamNumber ? (
              <p className="mt-1 text-sm text-slate-300">Phụ trách tổ {session.teamNumber}</p>
            ) : null}
            <form action={logoutAction} className="mt-4">
              <button className="button-secondary w-full bg-white/10 text-white hover:bg-white/15" type="submit">
                Đăng xuất
              </button>
            </form>
          </div>

          <div className="mt-4 space-y-2">
            {allowedViews.map((view) => (
              <Link
                className={`block rounded-2xl px-4 py-3 text-sm font-medium ${
                  currentView === view ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-700"
                }`}
                href={`/dashboard?view=${view}&year=${data.currentSchoolYear?._id ?? ""}`}
                key={view}
              >
                {navLabels[view]}
              </Link>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <header className="card p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="badge">{data.currentSchoolYear?.label}</div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                  {data.classConfig?.fullName ?? "Dashboard chủ nhiệm"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                  Web luôn ưu tiên năm học hiện hành, nhưng bạn có thể chuyển năm để xem lại dữ liệu
                  quá khứ, báo cáo, phụ huynh và lịch sử chỉnh sửa.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Chọn năm học</p>
                <div className="flex flex-wrap gap-2">
                  {data.schoolYears.map((year) => (
                    <Link
                      className={`rounded-full px-3 py-2 text-sm font-medium ${
                        year._id === data.currentSchoolYear?._id
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                      href={`/dashboard?view=${currentView}&year=${year._id}`}
                      key={year._id}
                    >
                      {year.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <section className="grid-cards">
            <OverviewCard icon={<Users size={18} />} label="Học sinh" value={`${data.students.length} em`} />
            <OverviewCard icon={<Phone size={18} />} label="Phụ huynh" value={`${data.parents.length} liên hệ`} />
            <OverviewCard icon={<CalendarDays size={18} />} label="Số tuần" value={`${data.currentSchoolYear?.weekCount ?? 0} tuần`} />
            <OverviewCard
              icon={<GraduationCap size={18} />}
              label="GVCN"
              value={data.classConfig?.gvcnDisplayName ?? "Chưa có"}
              helper={data.classConfig?.gvcnPhone}
            />
          </section>

          {currentView === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="card p-5">
                <div className="mb-4 flex items-center gap-2 text-slate-900">
                  <Shield size={18} />
                  <h3 className="text-lg font-semibold">Chức năng theo vai trò</h3>
                </div>
                <div className="space-y-4 text-sm leading-7 text-slate-700">
                  <RoleBox
                    title="GVCN và Admin"
                    body="Quản lý học sinh, phân tổ, phụ huynh, tài khoản, năm học, lịch sử chỉnh sửa và rà soát báo cáo toàn lớp."
                  />
                  <RoleBox
                    title="Lớp trưởng và lớp phó"
                    body="Nhập báo cáo tuần, theo dõi hoạt động chung, hỗ trợ GVCN tổng hợp và xem lại các báo cáo đã gửi."
                  />
                  <RoleBox
                    title="Tổ trưởng và tổ phó"
                    body="Theo dõi thành viên tổ, cập nhật báo cáo tổ và nắm phần việc rõ ràng theo từng tuần học."
                  />
                </div>
              </section>

              <section className="card p-5">
                <div className="mb-4 flex items-center gap-2 text-slate-900">
                  <Wallet size={18} />
                  <h3 className="text-lg font-semibold">Trạng thái năm học</h3>
                </div>
                <dl className="space-y-3 text-sm">
                  <MetricRow label="Bắt đầu" value={formatDate(data.currentSchoolYear?.startDate)} />
                  <MetricRow label="Kết thúc" value={formatDate(data.currentSchoolYear?.endDate)} />
                  <MetricRow label="Thi/Học kỳ" value={data.classConfig?.examTitle ?? "Chưa cấu hình"} />
                  <MetricRow label="Ngày mốc" value={formatDate(data.classConfig?.examDate)} />
                </dl>
                {(session.role === "admin" || session.role === "gvcn") && data.classConfig ? (
                  <div className="mt-4 rounded-3xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                    Chức năng riêng của giáo viên chủ nhiệm chỉ hiện khi đăng nhập bằng tài khoản
                    `gvcn` hoặc `admin`, bao gồm quản trị năm học, chia tổ và xem lịch sử chỉnh sửa.
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {currentView === "students" && canManageStudents(session.role) ? (
            <section className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <section className="card p-5">
                  <h3 className="text-lg font-semibold text-slate-900">Thêm hoặc cập nhật học sinh</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Dùng form này để quản lý chia tổ, chức vụ và số điện thoại phụ huynh trực tiếp
                    trên năm học đang chọn.
                  </p>
                  <StudentForm schoolYearId={data.currentSchoolYear?._id ?? ""} />
                </section>
                <section className="card p-5">
                  <h3 className="text-lg font-semibold text-slate-900">Sơ đồ tổ hiện tại</h3>
                  <div className="mt-4 space-y-3">
                    {[null, 1, 2, 3, 4].map((team) => (
                      <div className="rounded-3xl bg-slate-50 p-4" key={`team-${team ?? "none"}`}>
                        <p className="text-sm font-semibold text-slate-900">
                          {team ? `Tổ ${team}` : "Chưa gán tổ"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {(groupedStudents.get(team) ?? []).map((student) => student.fullName).join(", ") || "Chưa có dữ liệu"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="grid gap-3">
                {data.students.map((student) => (
                  <details className="card p-5" key={student._id}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{student.fullName}</p>
                          <p className="text-sm text-slate-600">
                            Tổ {student.teamNumber ?? "chưa gán"} | {student.position ?? "Chưa có chức vụ"}
                          </p>
                        </div>
                        <div className="text-sm text-slate-500">
                          PH: {student.parentPhone || "Chưa có"} <ArrowUpRight className="ml-1 inline" size={14} />
                        </div>
                      </div>
                    </summary>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <StudentForm schoolYearId={data.currentSchoolYear?._id ?? ""} student={student} />
                    </div>
                  </details>
                ))}
              </section>
            </section>
          ) : null}

          {currentView === "parents" && canManageParents(session.role) ? (
            <section className="space-y-4">
              <section className="card p-5">
                <h3 className="text-lg font-semibold text-slate-900">Thêm liên hệ phụ huynh</h3>
                <ParentForm schoolYearId={data.currentSchoolYear?._id ?? ""} />
              </section>
              <section className="grid gap-3 md:grid-cols-2">
                {data.parents.map((parent) => (
                  <details className="card p-5" key={parent._id}>
                    <summary className="cursor-pointer list-none">
                      <p className="text-lg font-semibold text-slate-900">{parent.studentName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {parent.parentName} - {parent.phone || "Chưa có số"}
                      </p>
                    </summary>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <ParentForm schoolYearId={data.currentSchoolYear?._id ?? ""} parent={parent} />
                    </div>
                  </details>
                ))}
              </section>
            </section>
          ) : null}

          {currentView === "reports" ? (
            <section className="space-y-4">
              <section className="card p-5">
                <h3 className="text-lg font-semibold text-slate-900">Nhập báo cáo tuần</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Lớp trưởng, lớp phó, tổ trưởng, thủ quỹ và GVCN có thể nhập báo cáo rồi xem lại,
                  chỉnh sửa sau đó. GVCN và admin còn có thể rà soát trạng thái các báo cáo đã nộp.
                </p>
                <ReportForm schoolYearId={data.currentSchoolYear?._id ?? ""} role={session.role} teamNumber={session.teamNumber} />
              </section>

              <section className="grid gap-3">
                {reportItems.map((report) => (
                  <details className="card p-5" key={report._id}>
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">
                            {report.weekLabel} - {formatRoleLabel(report.reporterRole)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {report.reporterName}
                            {report.teamNumber ? ` | Tổ ${report.teamNumber}` : ""}
                          </p>
                        </div>
                        <span className="badge">{report.status}</span>
                      </div>
                    </summary>
                    <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-3 text-sm leading-7 text-slate-700">
                        <InfoBlock label="Tổng hợp" value={report.summary} />
                        <InfoBlock label="Học tập" value={report.studyNotes} />
                        <InfoBlock label="Nề nếp" value={report.disciplineNotes} />
                        <InfoBlock label="Phong trào" value={report.activityNotes} />
                        <InfoBlock label="Tài chính" value={report.financeNotes} />
                        <InfoBlock label="Kế hoạch" value={report.futurePlan} />
                      </div>
                      <div>
                        <ReportForm
                          schoolYearId={data.currentSchoolYear?._id ?? ""}
                          report={report}
                          role={session.role}
                          teamNumber={session.teamNumber}
                        />
                      </div>
                    </div>
                  </details>
                ))}
              </section>
            </section>
          ) : null}

          {currentView === "school-years" && canManageSchoolYears(session.role) ? (
            <section className="space-y-4">
              <section className="card p-5">
                <h3 className="text-lg font-semibold text-slate-900">Tạo năm học mới hoặc cập nhật năm đang xem</h3>
                <SchoolYearForm current={data.currentSchoolYear ?? undefined} />
              </section>
              <section className="grid gap-3">
                {data.schoolYears.map((schoolYear) => (
                  <div className="card p-5" key={schoolYear._id}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{schoolYear.label}</p>
                        <p className="text-sm text-slate-600">
                          {formatDate(schoolYear.startDate)} - {formatDate(schoolYear.endDate)} | {schoolYear.weekCount} tuần
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {schoolYear.isCurrent ? <span className="badge">Hiện hành</span> : null}
                        <form action={setCurrentSchoolYearAction}>
                          <input name="schoolYearId" type="hidden" value={schoolYear._id} />
                          <button className="button-secondary" type="submit">
                            Đặt làm hiện hành
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            </section>
          ) : null}

          {currentView === "accounts" && canManageAccounts(session.role) ? (
            <section className="space-y-4">
              <section className="card p-5">
                <h3 className="text-lg font-semibold text-slate-900">Tạo hoặc cập nhật tài khoản</h3>
                <UserForm />
              </section>
              <section className="grid gap-3 md:grid-cols-2">
                {data.accounts.map((account) => (
                  <details className="card p-5" key={account._id}>
                    <summary className="cursor-pointer list-none">
                      <p className="text-lg font-semibold text-slate-900">{account.fullName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        @{account.username} - {formatRoleLabel(account.role)}
                      </p>
                    </summary>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <UserForm user={account} />
                    </div>
                  </details>
                ))}
              </section>
            </section>
          ) : null}

          {currentView === "audit" ? (
            <section className="grid gap-3">
              {data.auditLogs.map((log) => (
                <article className="card p-5" key={log._id}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{log.summary}</p>
                      <p className="text-sm text-slate-600">
                        {formatRoleLabel(log.actorRole)} - {log.actorName}
                      </p>
                    </div>
                    <div className="text-sm text-slate-500">{formatDate(log.createdAt)}</div>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function OverviewCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <article className="card p-5">
      <div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700">{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </article>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function RoleBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-slate-600">{body}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-slate-700">{value || "Chưa cập nhật"}</p>
    </div>
  );
}

function StudentForm({
  schoolYearId,
  student,
}: {
  schoolYearId: string;
  student?: {
    _id?: string;
    fullName: string;
    birthDay: number;
    birthMonth: number;
    teamNumber: number | null;
    position: string | null;
    parentPhone: string;
    parentName: string;
    notes: string;
  };
}) {
  return (
    <form action={saveStudentAction} className="mt-5 space-y-4">
      <input name="schoolYearId" type="hidden" value={schoolYearId} />
      <input name="studentId" type="hidden" value={student?._id ?? ""} />
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Họ tên</label>
          <input defaultValue={student?.fullName ?? ""} name="fullName" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Ngày sinh</label>
          <input defaultValue={student?.birthDay ?? 1} max={31} min={1} name="birthDay" type="number" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tháng sinh</label>
          <input defaultValue={student?.birthMonth ?? 1} max={12} min={1} name="birthMonth" type="number" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tổ</label>
          <select defaultValue={student?.teamNumber ?? ""} name="teamNumber">
            <option value="">Chưa gán</option>
            <option value="1">Tổ 1</option>
            <option value="2">Tổ 2</option>
            <option value="3">Tổ 3</option>
            <option value="4">Tổ 4</option>
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Chức vụ</label>
          <input defaultValue={student?.position ?? ""} name="position" placeholder="Lớp trưởng, tổ phó..." />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tên phụ huynh</label>
          <input defaultValue={student?.parentName ?? ""} name="parentName" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Số điện thoại phụ huynh</label>
          <input defaultValue={student?.parentPhone ?? ""} name="parentPhone" />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Ghi chú</label>
        <textarea defaultValue={student?.notes ?? ""} name="notes" />
      </div>
      <button className="button-primary" type="submit">
        {student ? "Lưu chỉnh sửa" : "Thêm học sinh"}
      </button>
    </form>
  );
}

function ParentForm({
  schoolYearId,
  parent,
}: {
  schoolYearId: string;
  parent?: {
    _id?: string;
    studentName: string;
    parentName: string;
    relationship: string;
    phone: string;
    note: string;
  };
}) {
  return (
    <form action={saveParentAction} className="mt-5 space-y-4">
      <input name="schoolYearId" type="hidden" value={schoolYearId} />
      <input name="parentId" type="hidden" value={parent?._id ?? ""} />
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Học sinh</label>
          <input defaultValue={parent?.studentName ?? ""} name="studentName" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tên phụ huynh</label>
          <input defaultValue={parent?.parentName ?? ""} name="parentName" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Quan hệ</label>
          <input defaultValue={parent?.relationship ?? "Phụ huynh"} name="relationship" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Số điện thoại</label>
          <input defaultValue={parent?.phone ?? ""} name="phone" required />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Ghi chú</label>
        <textarea defaultValue={parent?.note ?? ""} name="note" />
      </div>
      <button className="button-primary" type="submit">
        {parent ? "Lưu liên hệ" : "Thêm liên hệ"}
      </button>
    </form>
  );
}

function ReportForm({
  schoolYearId,
  role,
  teamNumber,
  report,
}: {
  schoolYearId: string;
  role: AppRole;
  teamNumber: number | null;
  report?: {
    _id?: string;
    weekNumber: number;
    weekLabel: string;
    summary: string;
    studyNotes: string;
    disciplineNotes: string;
    activityNotes: string;
    financeNotes: string;
    futurePlan: string;
    status: "draft" | "submitted" | "reviewed";
  };
}) {
  return (
    <form action={saveReportAction} className="mt-5 space-y-4">
      <input name="schoolYearId" type="hidden" value={schoolYearId} />
      <input name="reportId" type="hidden" value={report?._id ?? ""} />
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Vai trò gửi</label>
          <input disabled value={`${formatRoleLabel(role)}${teamNumber ? ` - Tổ ${teamNumber}` : ""}`} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Số tuần</label>
          <input defaultValue={report?.weekNumber ?? 1} name="weekNumber" type="number" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Nhãn tuần</label>
          <input defaultValue={report?.weekLabel ?? "Tuần 1"} name="weekLabel" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Trạng thái</label>
          <select defaultValue={report?.status ?? "submitted"} name="status">
            <option value="draft">Nháp</option>
            <option value="submitted">Đã nộp</option>
            <option value="reviewed">Đã rà soát</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Tổng hợp tuần</label>
        <textarea defaultValue={report?.summary ?? ""} name="summary" />
      </div>
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Học tập</label>
          <textarea defaultValue={report?.studyNotes ?? ""} name="studyNotes" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Nề nếp</label>
          <textarea defaultValue={report?.disciplineNotes ?? ""} name="disciplineNotes" />
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Phong trào</label>
          <textarea defaultValue={report?.activityNotes ?? ""} name="activityNotes" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tài chính / quỹ</label>
          <textarea defaultValue={report?.financeNotes ?? ""} name="financeNotes" />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Kế hoạch tuần tới</label>
        <textarea defaultValue={report?.futurePlan ?? ""} name="futurePlan" />
      </div>
      <button className="button-primary" type="submit">
        {report ? "Cập nhật báo cáo" : "Lưu báo cáo"}
      </button>
    </form>
  );
}

function SchoolYearForm({
  current,
}: {
  current?: {
    _id?: string;
    name: string;
    startDate: string;
    endDate: string;
    weekCount: number;
  };
}) {
  return (
    <form action={saveSchoolYearAction} className="mt-5 space-y-4">
      <input name="schoolYearId" type="hidden" value={current?._id ?? ""} />
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tên năm học</label>
          <input defaultValue={current?.name ?? ""} name="name" placeholder="2026-2027" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Ngày bắt đầu</label>
          <input defaultValue={current?.startDate?.slice(0, 10) ?? ""} name="startDate" type="date" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Ngày kết thúc</label>
          <input defaultValue={current?.endDate?.slice(0, 10) ?? ""} name="endDate" type="date" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Số tuần</label>
          <input defaultValue={current?.weekCount ?? 35} min={1} name="weekCount" type="number" />
        </div>
      </div>
      <button className="button-primary" type="submit">
        Lưu năm học đang xem
      </button>
    </form>
  );
}

function UserForm({
  user,
}: {
  user?: {
    _id?: string;
    username: string;
    fullName: string;
    role: AppRole;
    teamNumber: number | null;
    schoolYearScope: "all" | "current";
    active: boolean;
  };
}) {
  return (
    <form action={saveUserAction} className="mt-5 space-y-4">
      <input name="userId" type="hidden" value={user?._id ?? ""} />
      <div className="form-grid">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Username</label>
          <input defaultValue={user?.username ?? ""} name="username" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Họ tên</label>
          <input defaultValue={user?.fullName ?? ""} name="fullName" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Vai trò</label>
          <select defaultValue={user?.role ?? "toPho"} name="role">
            {APP_ROLES.map((role) => (
              <option key={role} value={role}>
                {formatRoleLabel(role)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Tổ phụ trách</label>
          <select defaultValue={user?.teamNumber ?? ""} name="teamNumber">
            <option value="">Không gắn tổ</option>
            <option value="1">Tổ 1</option>
            <option value="2">Tổ 2</option>
            <option value="3">Tổ 3</option>
            <option value="4">Tổ 4</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Phạm vi năm học</label>
          <select defaultValue={user?.schoolYearScope ?? "current"} name="schoolYearScope">
            <option value="current">Chỉ năm hiện hành</option>
            <option value="all">Tất cả năm học</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Kích hoạt</label>
          <select defaultValue={user?.active ? "true" : "false"} name="active">
            <option value="true">Đang hoạt động</option>
            <option value="false">Tạm khóa</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Mật khẩu {user ? "(để trống nếu không đổi)" : ""}
        </label>
        <input name="password" type="password" />
      </div>
      <button className="button-primary" type="submit">
        {user ? "Cập nhật tài khoản" : "Tạo tài khoản"}
      </button>
    </form>
  );
}
