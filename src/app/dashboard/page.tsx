import Link from "next/link";

import { SubmitButton } from "@/components/SubmitButton";
import { GvcnDesk } from "@/components/gvcn/GvcnDesk";

import {
  logoutAction,
  saveParentAction,
  saveSchoolYearAction,
  saveStudentAction,
  saveUserAction,
  setCurrentSchoolYearAction,
} from "@/app/dashboard/actions";
import { requireGvcn } from "@/lib/access";
import { getDashboardData } from "@/lib/data";
import { getClassIdentity } from "@/lib/public-site";
import {
  canManageAccounts,
  canManageParents,
  canManageSchoolYears,
  canManageStudents,
  getAllowedViews,
} from "@/lib/permissions";
import { classDutyOptions } from "@/lib/team-roster";
import type { AppRole, ClassDuty, NavView } from "@/lib/types";
import { APP_ROLES } from "@/lib/types";
import { formatDate, formatRoleLabel } from "@/lib/utils";

const navLabels: Record<NavView, string> = {
  overview: "Tổng quan",
  students: "Học sinh",
  parents: "Phụ huynh",
  reports: "Tổng kết tuần",
  "school-years": "Năm học",
  accounts: "Tài khoản",
  audit: "Lịch sử",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; week?: string }>;
}) {
  // requireGvcn sends a non-teacher session to the GVCN login form. It must NOT
  // bounce an officer to their own report page: a student's leftover session
  // would then lock the teacher out of the setup desk with no way to sign in.
  const session = await requireGvcn("/dashboard");

  const params = await searchParams;
  const site = await getClassIdentity();

  const allowedViews = getAllowedViews(session.role);
  const currentView = (allowedViews.includes(params.view as NavView) ? params.view : allowedViews[0]) as NavView;

  if (session.role === "gvcn") {
    // Hand the tab down from the URL so a refresh or a shared link reopens the
    // same panel instead of always falling back to Tổng kết tuần.
    return (
      <main>
        <GvcnDesk
          fullName={session.fullName}
          initialClassName={site.className}
          initialView={params.view}
        />
      </main>
    );
  }

  const data = await getDashboardData(params.year, currentView);

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
                  Ban cán sự nộp báo cáo theo tuần. GVCN chỉ xem tổng kết tuần nào đã có báo cáo
                  của từng chức vụ, không nhập thay cán sự.
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
            <OverviewCard icon="👥" label="Học sinh" value={`${data.studentCount} em`} />
            <OverviewCard icon="📞" label="Phụ huynh" value={`${data.parentCount} liên hệ`} />
            <OverviewCard icon="📅" label="Số tuần" value={`${data.currentSchoolYear?.weekCount ?? 0} tuần`} />
            <OverviewCard
              icon="🎓"
              label="GVCN"
              value={data.classConfig?.gvcnDisplayName ?? "Chưa có"}
              helper={data.classConfig?.gvcnPhone}
            />
          </section>

          {currentView === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="card p-5">
                <div className="mb-4 flex items-center gap-2 text-slate-900">
                  <h3 className="text-lg font-semibold">Chức năng theo vai trò</h3>
                </div>
                <div className="space-y-4 text-sm leading-7 text-slate-700">
                  <RoleBox
                    title="Ban cán sự"
                    body="Lớp trưởng, lớp phó, tổ trưởng và thủ quỹ mỗi người một form báo cáo tuần riêng, giống web gốc."
                  />
                  <RoleBox
                    title="Giáo viên chủ nhiệm"
                    body="Không nhập báo cáo tuần. Chỉ tổng kết tuần đó đã có báo cáo của chức vụ nào, còn thiếu chức vụ nào."
                  />
                  <RoleBox
                    title="Năm học"
                    body="Web luôn bám năm hiện hành. Có thể chuyển năm để xem lại lịch sử báo cáo các năm trước."
                  />
                </div>
              </section>

              <section className="card p-5">
                <div className="mb-4 flex items-center gap-2 text-slate-900">
                  <h3 className="text-lg font-semibold">Trạng thái năm học</h3>
                </div>
                <dl className="space-y-3 text-sm">
                  <MetricRow label="Bắt đầu" value={formatDate(data.currentSchoolYear?.startDate)} />
                  <MetricRow label="Kết thúc" value={formatDate(data.currentSchoolYear?.endDate)} />
                  <MetricRow label="Thi/Học kỳ" value={data.classConfig?.examTitle ?? "Chưa cấu hình"} />
                  <MetricRow label="Ngày mốc" value={formatDate(data.classConfig?.examDate)} />
                </dl>
                {((session.role as string) === "admin" || (session.role as string) === "gvcn") && data.classConfig ? (
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
                          PH: {student.parentPhone || "Chưa có"}
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
            <GvcnDesk fullName={session.fullName} />
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
                          <SubmitButton className="button-secondary" pendingText="Đang đặt…">
                            Đặt làm hiện hành
                          </SubmitButton>
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
    classDuty: ClassDuty | null;
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
          <label className="mb-2 block text-sm font-medium text-slate-700">Chức vụ lớp</label>
          {/* Chọn từ danh sách chuẩn thay vì gõ tay: cùng một chức vụ mà mỗi chỗ
              gõ một kiểu thì sơ đồ lớp, Excel và tài khoản đăng nhập lệch nhau. */}
          <select defaultValue={student?.classDuty ?? ""} name="classDuty">
            <option value="">Không giữ chức</option>
            {classDutyOptions().map((duty) => (
              <option key={duty.value} value={duty.value}>
                {duty.label}
              </option>
            ))}
          </select>
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
      <SubmitButton pendingText="Đang lưu…">
        {student ? "Lưu chỉnh sửa" : "Thêm học sinh"}
      </SubmitButton>
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
      <SubmitButton pendingText="Đang lưu…">
        {parent ? "Lưu liên hệ" : "Thêm liên hệ"}
      </SubmitButton>
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
      <SubmitButton pendingText="Đang lưu…">
        Lưu năm học đang xem
      </SubmitButton>
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
      <SubmitButton pendingText="Đang lưu…">
        {user ? "Cập nhật tài khoản" : "Tạo tài khoản"}
      </SubmitButton>
    </form>
  );
}
