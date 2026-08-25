"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import {
  SEAT_SIDES,
  SEAT_SIDE_LABELS,
  SEAT_TEAMS,
  seatKey,
  type SeatSide,
} from "@/lib/syll-seats";
import { CLASS_DUTY_LABELS, TEAM_ROLE_LABELS } from "@/lib/team-roster";
import { CLASS_DUTIES, type ClassDuty, type TeamRole } from "@/lib/types";

type RosterStudent = {
  _id: string;
  tt: number | null;
  fullName: string;
  submitted: boolean;
  teamNumber: number | null;
  teamRole: TeamRole | null;
  classDuty: ClassDuty | null;
  seatDesk: number | null;
  seatSide: SeatSide | null;
};

/** Một danh sách chức vụ duy nhất, gộp chức vụ lớp và chức vụ tổ. */
const DUTY_OPTIONS: Array<{ value: string; label: string }> = [
  ...CLASS_DUTIES.map((duty) => ({ value: duty, label: CLASS_DUTY_LABELS[duty] })),
  { value: "toTruong", label: TEAM_ROLE_LABELS.toTruong },
  { value: "toPho", label: TEAM_ROLE_LABELS.toPho },
];

/**
 * Đúng bốn diện nhà trường thống kê, lưu bằng mã viết tắt như trong sổ để cột
 * "Diện chính sách" của biểu mẫu ra đúng chữ trường quen đọc.
 */
const POLICY_OPTIONS = [
  { value: "Không", label: "Không thuộc diện nào" },
  { value: "HN", label: "HN — Hộ nghèo" },
  { value: "CN", label: "CN — Cận nghèo" },
  { value: "KK", label: "KK — Hoàn cảnh khó khăn" },
];

/** "on" là giá trị ô tick của bản cũ; mọi thứ khác chữ "không" đều tính là biết bơi. */
function swimValue(raw: string | undefined) {
  if (!raw) return "";
  return /^(kh[oô]ng|no)/i.test(raw.trim()) ? "Không" : "x";
}

/** Hồ sơ em đã khai lần trước, dùng để điền sẵn lại toàn bộ form. */
type SyllProfile = {
  birthDate: string;
  birthPlace: string;
  gender: string;
  ethnicity: string;
  policy: string;
  conduct: string;
  academic: string;
  addressGroup: string;
  addressWard: string;
  addressProvince: string;
  fatherName: string;
  fatherJob: string;
  motherName: string;
  motherJob: string;
  contactPhone: string;
  motherPhone: string;
  studentPhone: string;
  email: string;
  idNumber: string;
  weight: string;
  height: string;
  canSwim: string;
  eyeDisease: string;
  medicalHistory: string;
  transport: string;
  onlineLearning: string;
  notes: string;
  classDuty: ClassDuty | null;
  teamRole: TeamRole | null;
  teamNumber: number | null;
  seatDesk: number | null;
  seatSide: SeatSide | null;
  submittedAt: string;
};

function foldVi(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/** Hồ sơ trả ngày sinh dạng 24/08/2010; ba ô Ngày / tháng / năm cần ba số rời. */
function splitBirth(text?: string) {
  const match = (text || "").match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return { day: "", month: "", year: "" };
  return { day: match[1], month: match[2], year: match[3] ?? "" };
}

function Field({
  label,
  name,
  hint,
  required,
  type = "text",
  placeholder,
  inputMode,
  wide,
  defaultValue,
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  wide?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className={`syll-field${wide ? " syll-span" : ""}`}>
      <span className="syll-label">
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      <input
        autoComplete="off"
        defaultValue={defaultValue}
        inputMode={inputMode}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {hint ? <em className="syll-hint-inline">{hint}</em> : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="syll-field">
      <span className="syll-label">
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      <select autoComplete="off" defaultValue={defaultValue ?? ""} name={name} required={required}>
        {options.map((option) => (
          // Dòng trống để làm lời nhắc chứ không phải một câu trả lời: khoá lại
          // thì trình duyệt bắt em phải chọn một mức thật.
          <option disabled={required && !option} key={option} value={option}>
            {option || "— Chọn —"}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Nhóm lựa chọn dạng "segmented": các ô chia đều một hàng lưới thay vì trôi tự
 * do. Bản cũ dùng flex-wrap nên mỗi ô rộng khác nhau, chữ dài thì rớt xuống
 * dòng mới và kéo lệch cả hàng bên cạnh.
 */
function RadioGroup({
  label,
  name,
  options,
  columns,
  wide,
  value,
  required,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string; icon?: string }>;
  columns?: number;
  wide?: boolean;
  value?: string;
  required?: boolean;
}) {
  return (
    <div className={`syll-field${wide ? " syll-span" : ""}`}>
      <span className="syll-label">
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      <div className="syll-seg" style={{ "--seg-cols": columns ?? options.length } as React.CSSProperties}>
        {options.map((option) => (
          <label className="syll-seg-item" key={option.value}>
            <input
              defaultChecked={value === option.value}
              name={name}
              required={required}
              type="radio"
              value={option.value}
            />
            <span>
              {option.icon ? <i aria-hidden="true">{option.icon}</i> : null}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="syll-block">
      <header className="syll-block-head">
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
      </header>
      <div className="syll-grid">{children}</div>
    </section>
  );
}

export function SyllForm({ siteName }: { siteName: string }) {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rosterError, setRosterError] = useState("");
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [deskCount, setDeskCount] = useState(6);
  const [duty, setDuty] = useState("");
  const [team, setTeam] = useState("");
  const [seat, setSeat] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [gate, setGate] = useState<"checking" | "closed" | "open">("checking");
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [gateError, setGateError] = useState("");
  const [profile, setProfile] = useState<SyllProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const response = await fetch("/api/syll");
      if (!response.ok) throw new Error("roster");
      const data = (await response.json()) as { students?: RosterStudent[]; deskCount?: number };
      setRoster(data.students ?? []);
      if (data.deskCount) setDeskCount(data.deskCount);
      setRosterError("");
    } catch {
      setRosterError("Chưa tải được danh sách lớp. Tải lại trang giúp thầy cô nhé.");
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/syll/unlock");
        const data = (await response.json()) as { unlocked?: boolean; locked?: boolean };
        if (cancelled) return;
        setLocked(Boolean(data.locked));
        setGate(data.unlocked ? "open" : "closed");
        if (data.unlocked) await loadRoster();
      } catch {
        if (!cancelled) setGate("closed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRoster]);

  /**
   * Chọn tên xong thì kéo về hồ sơ em đã khai lần trước. Form dùng ô không điều
   * khiển nên phải gắn key theo mã học sinh để React dựng lại, nếu không giá trị
   * mặc định mới sẽ không được áp vào ô đang hiện.
   */
  async function pickStudent(nextId: string) {
    setStudentId(nextId);
    setProfile(null);
    setDuty("");
    setTeam("");
    setSeat("");
    setError("");
    if (!nextId) return;

    setLoadingProfile(true);
    try {
      const response = await fetch(`/api/syll/profile?studentId=${encodeURIComponent(nextId)}`);
      if (!response.ok) return;
      const data = (await response.json()) as { profile?: SyllProfile };
      if (!data.profile) return;
      setProfile(data.profile);
      setDuty(data.profile.classDuty ?? (data.profile.teamRole === "toTruong" || data.profile.teamRole === "toPho" ? data.profile.teamRole : ""));
      setTeam(data.profile.teamNumber ? String(data.profile.teamNumber) : "");
      setSeat(data.profile.seatDesk && data.profile.seatSide ? `${data.profile.seatDesk}-${data.profile.seatSide}` : "");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setGateError("");
    try {
      const body = new FormData();
      body.set("password", password);
      const response = await fetch("/api/syll/unlock", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGateError(data.error || "Không mở được. Thử lại nhé.");
        return;
      }
      setLocked(Boolean(data.locked));
      setGate("open");
      setPassword("");
      await loadRoster();
    } catch {
      setGateError("Không mở được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPending(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = foldVi(query.trim());
    if (!needle) return roster;
    return roster.filter((student) => foldVi(student.fullName).includes(needle));
  }, [roster, query]);

  const selected = roster.find((student) => student._id === studentId) ?? null;
  const filledCount = roster.filter((student) => student.submitted).length;
  const birth = splitBirth(profile?.birthDate);

  /** Chỗ nào đã có bạn ngồi thì khoá lại, trừ chỗ của chính em đang khai. */
  const takenSeats = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of roster) {
      if (student._id === studentId) continue;
      if (!student.teamNumber || !student.seatDesk || !student.seatSide) continue;
      map.set(
        seatKey({ team: student.teamNumber, desk: student.seatDesk, side: student.seatSide }),
        student.fullName,
      );
    }
    return map;
  }, [roster, studentId]);

  const takenDuties = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of roster) {
      if (student._id === studentId) continue;
      if (student.classDuty) map.set(student.classDuty, student.fullName);
      if (student.teamNumber && (student.teamRole === "toTruong" || student.teamRole === "toPho")) {
        map.set(`${student.teamRole}-${student.teamNumber}`, student.fullName);
      }
    }
    return map;
  }, [roster, studentId]);

  function dutyHolder(value: string) {
    if (!value) return "";
    if (value === "toTruong" || value === "toPho") {
      return team ? takenDuties.get(`${value}-${team}`) ?? "" : "";
    }
    return takenDuties.get(value) ?? "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentId) {
      setError("Chọn tên em trong danh sách lớp trước đã.");
      return;
    }
    // Ô chỗ ngồi là nút bấm nên trình duyệt không tự kiểm được như các ô khác.
    if (!team) {
      setError("Chọn tổ của em giúp thầy cô nhé.");
      return;
    }
    if (!seat) {
      setError("Chọn chỗ ngồi của em trong sơ đồ bên trên nhé.");
      return;
    }
    const form = event.currentTarget;
    setPending(true);
    setError("");
    try {
      const formData = new FormData(form);
      formData.set("studentId", studentId);
      formData.set("duty", duty);
      formData.set("teamNumber", team);
      const [seatDesk, seatSide] = seat ? seat.split("-") : ["", ""];
      formData.set("seatDesk", seatDesk);
      formData.set("seatSide", seatSide);
      const response = await fetch("/api/syll", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Không gửi được sơ yếu lý lịch.");
        return;
      }
      setDone(data.fullName || selected?.fullName || "");
      setRoster((current) =>
        current.map((student) => (student._id === studentId ? { ...student, submitted: true } : student)),
      );
    } catch {
      setError("Không gửi được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPending(false);
    }
  }

  function pickTeam(next: string) {
    setTeam(next);
    // Chỗ ngồi thuộc về một tổ cụ thể, đổi tổ thì chỗ vừa chọn không còn nghĩa.
    setSeat("");
  }

  function startAnother() {
    setDone("");
    setStudentId("");
    setQuery("");
    setDuty("");
    setTeam("");
    setSeat("");
    setProfile(null);
    formRef.current?.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <div className="syll-done">
        <div className="syll-done-mark" aria-hidden="true">
          ✓
        </div>
        <h2>Đã nhận sơ yếu lý lịch của {done}</h2>
        <p>
          Thông tin đã vào dữ liệu lớp. GVCN sẽ thấy em trong danh sách &quot;đã điền&quot; và xuất Excel theo đúng
          biểu mẫu nhà trường.
        </p>
        <p className="syll-done-count">
          Lớp đã khai {filledCount}/{roster.length} em.
        </p>
        <button className="button-primary" onClick={startAnother} type="button">
          Khai cho bạn khác
        </button>
      </div>
    );
  }

  if (gate !== "open") {
    return (
      <form className="syll-gate" onSubmit={(event) => void unlock(event)}>
        <div className="syll-gate-mark" aria-hidden="true">
          🔒
        </div>
        <h2>Nhập mật khẩu của lớp</h2>
        <p>Thầy cô cho lớp mật khẩu này. Nhập một lần là khai được cả buổi.</p>
        <label className="syll-field">
          <span className="syll-label">Mật khẩu</span>
          <input
            autoFocus
            disabled={gate === "checking"}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mật khẩu thầy cô cho"
            type="password"
            value={password}
          />
        </label>
        {gateError ? <p className="syll-err">{gateError}</p> : null}
        <button className="button-primary" disabled={pending || gate === "checking"} type="submit">
          {gate === "checking" ? "Đang kiểm tra…" : pending ? "Đang mở…" : "Vào khai"}
        </button>
        <p className="syll-foot">{siteName}</p>
      </form>
    );
  }

  if (locked) {
    return (
      <div className="syll-done">
        <div className="syll-done-mark syll-done-lock" aria-hidden="true">
          🔒
        </div>
        <h2>GVCN đã chốt sổ sơ yếu lý lịch</h2>
        <p>
          Danh sách đã khóa nên không nhận khai mới và cũng không sửa được nữa. Cần chỉnh chỗ nào thì em báo trực
          tiếp với thầy cô nhé.
        </p>
        <p className="syll-done-count">{siteName}</p>
      </div>
    );
  }

  return (
    <form
      autoComplete="off"
      className="syll-form"
      onSubmit={(event) => void handleSubmit(event)}
      ref={formRef}
    >
      <section className="syll-picker">
        <header className="syll-block-head">
          <h2>1. Chọn tên em</h2>
          <p>Danh sách do GVCN nhập từ file của trường — chọn đúng tên để không lệch số thứ tự.</p>
        </header>

        {rosterError ? <p className="syll-err">{rosterError}</p> : null}

        <div className="syll-picker-row">
          <label className="syll-field">
            <span className="syll-label">Tìm nhanh</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Gõ vài chữ trong tên…"
              type="search"
              value={query}
            />
          </label>
          {/* Danh sách mở sẵn thay cho ô chọn xổ xuống: 43 dòng xổ ra là che
              gần hết màn hình điện thoại và tên dài bị cắt. Khung này cao vừa
              mười dòng, còn lại cuộn trong khung. */}
          <div className="syll-field syll-picker-names">
            <span className="syll-label">
              Họ và tên<b aria-hidden="true"> *</b>
            </span>
            {loadingRoster ? (
              <p className="syll-note">Đang tải danh sách…</p>
            ) : !roster.length ? (
              <p className="syll-note">Lớp chưa có danh sách.</p>
            ) : (
              <ul className="syll-names">
                {filtered.map((student) => (
                  <li key={student._id}>
                    <button
                      aria-pressed={studentId === student._id}
                      className={`syll-name${studentId === student._id ? " is-picked" : ""}`}
                      onClick={() => void pickStudent(student._id)}
                      type="button"
                    >
                      <b>{student.tt ? `${student.tt}.` : "•"}</b>
                      <span>{student.fullName}</span>
                      {student.submitted ? <em title="đã khai">✓</em> : null}
                    </button>
                  </li>
                ))}
                {!filtered.length ? <li className="syll-names-empty">Không có tên nào khớp.</li> : null}
              </ul>
            )}
          </div>
        </div>

        {!loadingRoster && !roster.length ? (
          <p className="syll-note">
            GVCN chưa nhập danh sách lớp. Thầy cô vào <b>Khu vực GVCN → Sơ yếu lý lịch</b> để tải mẫu và nhập lên.
          </p>
        ) : null}

        {loadingProfile ? <p className="syll-note">Đang lấy lại thông tin em đã khai…</p> : null}

        {selected?.submitted && !loadingProfile ? (
          <p className="syll-note syll-note-warn">
            {selected.fullName} đã khai rồi — form bên dưới đã điền sẵn thông tin cũ. Em chỉ cần sửa chỗ nào thay
            đổi rồi gửi lại.
          </p>
        ) : null}

        {roster.length ? (
          <p className="syll-progress">
            Lớp đã khai <b>{filledCount}</b>/{roster.length} em.
          </p>
        ) : null}
      </section>

      {/* Khoá React theo cả hồ sơ chứ không chỉ theo học sinh: hồ sơ về sau lúc
          chọn tên, mà <select autoComplete="off"> và radio chỉ nhận defaultValue lúc dựng — không
          dựng lại thì dân tộc, diện chính sách, giới tính vẫn nằm ở giá trị rỗng. */}
      <fieldset
        className="syll-fieldset"
        disabled={!studentId || loadingProfile}
        key={`${studentId || "empty"}-${profile ? "filled" : "blank"}`}
      >
        <legend className="sr-only">Thông tin sơ yếu lý lịch</legend>

        <Section title="2. Thông tin học sinh">
          {/* Ba ô rời "Ngày … tháng … năm …": mỗi ô chỉ nhận một hai chữ số nên
              không còn cảnh gõ nhầm thứ tự ngày với tháng, và bàn phím số trên
              điện thoại không có dấu "/" cũng không sao. */}
          <div className="syll-field syll-span">
            <span className="syll-label">
              Ngày sinh<b aria-hidden="true"> *</b>
            </span>
            <div className="syll-birth">
              <label>
                <span>Ngày</span>
                <input
                  autoComplete="off"
                  defaultValue={birth.day}
                  inputMode="numeric"
                  max={31}
                  min={1}
                  name="birthDay"
                  placeholder="20"
                  required
                  type="number"
                />
              </label>
              <label>
                <span>tháng</span>
                <input
                  autoComplete="off"
                  defaultValue={birth.month}
                  inputMode="numeric"
                  max={12}
                  min={1}
                  name="birthMonth"
                  placeholder="10"
                  required
                  type="number"
                />
              </label>
              <label className="syll-birth-year">
                <span>năm</span>
                <input
                  autoComplete="off"
                  defaultValue={birth.year}
                  inputMode="numeric"
                  max={2020}
                  min={1990}
                  name="birthYear"
                  placeholder="2009"
                  required
                  type="number"
                />
              </label>
            </div>
            <em className="syll-hint-inline">Thầy cô đã điền sẵn theo sổ lớp — em xem lại, sai thì sửa.</em>
          </div>
          <Field label="Nơi sinh (tỉnh)" name="birthPlace" placeholder="An Giang" required
            defaultValue={profile?.birthPlace ?? ""}
          />
          <SelectField
            label="Dân tộc"
            name="ethnicity"
            defaultValue={profile?.ethnicity || "Kinh"}
            options={["Kinh", "Hoa", "Khmer", "Chăm", "Khác"]}
            required
          />
          <RadioGroup
            label="Giới tính"
            name="gender"
            required
            value={profile?.gender ?? ""}
            options={[
              { value: "Nam", label: "Nam" },
              { value: "Nữ", label: "Nữ" },
            ]}
          />
          <label className="syll-field">
            <span className="syll-label">
              Diện chính sách<b aria-hidden="true"> *</b>
            </span>
            <select autoComplete="off" defaultValue={profile?.policy ?? ""} name="policy" required>
              <option disabled value="">
                — Chọn —
              </option>
              {POLICY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <em className="syll-hint-inline">HN: hộ nghèo · CN: cận nghèo · KK: hoàn cảnh khó khăn</em>
          </label>
          <SelectField
            label="Rèn luyện năm trước"
            name="conduct"
            defaultValue={profile?.conduct ?? ""}
            options={["", "Tốt", "Khá", "Đạt", "Chưa đạt"]}
            required
          />
          <SelectField
            label="Học tập năm trước"
            name="academic"
            defaultValue={profile?.academic ?? ""}
            options={["", "Tốt", "Khá", "Đạt", "Chưa đạt"]}
            required
          />

          <label className="syll-field">
            <span className="syll-label">Chức vụ</span>
            <select autoComplete="off" onChange={(event) => setDuty(event.target.value)} value={duty}>
              <option value="">Không giữ chức vụ</option>
              {DUTY_OPTIONS.map((option) => {
                const holder = dutyHolder(option.value);
                return (
                  <option disabled={Boolean(holder)} key={option.value} value={option.value}>
                    {option.label}
                    {holder ? ` — đã có ${holder}` : ""}
                  </option>
                );
              })}
            </select>
            <em className="syll-hint-inline">Giữ hai chức thì chọn một, nhờ GVCN thêm chức còn lại.</em>
          </label>

          <label className="syll-field">
            <span className="syll-label">
              Tổ<b aria-hidden="true"> *</b>
            </span>
            <select autoComplete="off" onChange={(event) => pickTeam(event.target.value)} required value={team}>
              <option value="">— Chọn tổ —</option>
              {SEAT_TEAMS.map((number) => (
                <option key={number} value={number}>
                  Tổ {number}
                </option>
              ))}
            </select>
          </label>

          <div className="syll-field syll-span">
            <span className="syll-label">
              Chỗ ngồi<b aria-hidden="true"> *</b>
            </span>
            {!team ? (
              <p className="syll-note">Chọn tổ ở trên thì sơ đồ chỗ ngồi của tổ đó hiện ra.</p>
            ) : (
              <>
                <div className="syll-seats">
                  {Array.from({ length: deskCount }, (_, index) => index + 1).map((desk) => (
                    <div className="syll-seat-row" key={desk}>
                      <span className="syll-seat-desk">Bàn {desk}</span>
                      {SEAT_SIDES.map((side) => {
                        const value = `${desk}-${side}`;
                        const holder = takenSeats.get(seatKey({ team: Number(team), desk, side }));
                        return (
                          <button
                            aria-pressed={seat === value}
                            className={`syll-seat${seat === value ? " is-picked" : ""}${holder ? " is-taken" : ""}`}
                            disabled={Boolean(holder)}
                            key={value}
                            onClick={() => setSeat(seat === value ? "" : value)}
                            title={holder ? `${SEAT_SIDE_LABELS[side]} — ${holder} đã ngồi` : SEAT_SIDE_LABELS[side]}
                            type="button"
                          >
                            <b>{SEAT_SIDE_LABELS[side].replace("Chỗ phía ", "")}</b>
                            <span>{holder ?? (seat === value ? "chỗ của em" : "còn trống")}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <em className="syll-hint-inline">Ô mờ là bạn khác đã ngồi. Bàn 1 gần bảng nhất.</em>
              </>
            )}
          </div>
        </Section>

        <Section title="3. Chỗ ở hiện nay" note="Ghi rõ, không viết tắt — đây là mục nhà trường kiểm tra kỹ nhất.">
          <Field label="Tổ / ấp / khóm" name="addressGroup" placeholder="Tổ 8, ấp An Ninh" required
            defaultValue={profile?.addressGroup ?? ""}
          />
          <Field label="Xã / phường" name="addressWard" placeholder="Mỹ An Hưng" required
            defaultValue={profile?.addressWard ?? ""}
          />
          <Field label="Tỉnh / thành phố" name="addressProvince" placeholder="Đồng Tháp" required
            defaultValue={profile?.addressProvince ?? ""}
          />
        </Section>

        <Section title="4. Cha mẹ">
          <Field label="Họ và tên cha" name="fatherName" placeholder="Nguyễn Văn A"
            defaultValue={profile?.fatherName ?? ""}
            required
          />
          <Field label="Nghề nghiệp cha" name="fatherJob" placeholder="Nông dân"
            defaultValue={profile?.fatherJob ?? ""}
            required
          />
          <Field label="Họ và tên mẹ" name="motherName" placeholder="Trần Thị B"
            defaultValue={profile?.motherName ?? ""}
            required
          />
          <Field label="Nghề nghiệp mẹ" name="motherJob" placeholder="Nội trợ"
            defaultValue={profile?.motherJob ?? ""}
            required
          />
          <Field
            hint="Số GVCN gọi khi cần — thường là số của cha hoặc mẹ"
            inputMode="tel"
            label="SĐT liên lạc"
            name="contactPhone"
            placeholder="09xxxxxxxx"
            required
            defaultValue={profile?.contactPhone ?? ""}
          />
          <Field
            hint="Số riêng của mẹ, chỉ dùng để tra cứu — không in vào biểu mẫu"
            inputMode="tel"
            label="SĐT của mẹ"
            name="motherPhone"
            placeholder="09xxxxxxxx"
            defaultValue={profile?.motherPhone ?? ""}
            required
          />
        </Section>

        <Section title="5. Liên hệ của em">
          <Field inputMode="tel" label="SĐT của em" name="studentPhone" placeholder="09xxxxxxxx"
            defaultValue={profile?.studentPhone ?? ""}
            required
          />
          <Field label="Địa chỉ email" name="email" placeholder="ten@gmail.com" type="email"
            defaultValue={profile?.email ?? ""}
            required
          />
          <Field inputMode="numeric" label="Số CCCD / CMND" name="idNumber" placeholder="0892090…"
            defaultValue={profile?.idNumber ?? ""}
            required
          />
        </Section>

        <Section title="6. Sức khỏe">
          <Field inputMode="decimal" label="Cân nặng (kg)" name="weight" placeholder="48"
            defaultValue={profile?.weight ?? ""}
            required
          />
          <Field inputMode="decimal" label="Chiều cao (cm)" name="height" placeholder="160"
            defaultValue={profile?.height ?? ""}
            required
          />
          <RadioGroup
            label="Biết bơi"
            name="canSwim"
            required
            value={swimValue(profile?.canSwim)}
            options={[
              { value: "x", label: "Biết bơi", icon: "🏊" },
              { value: "Không", label: "Không biết", icon: "🚫" },
            ]}
          />
          <Field label="Bệnh về mắt" name="eyeDisease" placeholder="Không / cận thị / loạn thị…"
            defaultValue={profile?.eyeDisease ?? ""}
            required
          />
          <Field
            label="Tiền sử bệnh cần theo dõi"
            name="medicalHistory"
            placeholder="Không / hen suyễn, tim mạch…"
            wide
            defaultValue={profile?.medicalHistory ?? ""}
            required
          />
        </Section>

        <Section title="7. Đi lại & học trực tuyến">
          <RadioGroup
            label="Phương tiện đến trường"
            name="transport"
            required
            value={profile?.transport ?? ""}
            options={[
              { value: "Xe đạp", label: "Xe đạp", icon: "🚲" },
              { value: "Xe máy / máy điện", label: "Xe máy / điện", icon: "🛵" },
              { value: "Khác", label: "Khác", icon: "🚶" },
            ]}
            wide
          />
          <RadioGroup
            label="Điều kiện học trực tuyến"
            name="onlineLearning"
            required
            value={profile?.onlineLearning ?? ""}
            options={[
              { value: "Đủ đk học", label: "Đủ điều kiện" },
              { value: "Không đủ đk học", label: "Không đủ" },
              { value: "Có thể nhờ bạn để học", label: "Học nhờ bạn" },
            ]}
            wide
          />
          <Field label="Ghi chú thêm" name="notes" placeholder="Điều gì thầy cô cần biết thêm (nếu có)" wide
            defaultValue={profile?.notes ?? ""}
          />
        </Section>
      </fieldset>

      {error ? <p className="syll-err">{error}</p> : null}

      <div className="syll-actions">
        <p className="syll-foot">
          {siteName}. Thông tin lưu thẳng vào dữ liệu lớp và xuất Excel theo biểu mẫu nhà trường.
        </p>
        <button className="button-primary" disabled={pending || !studentId} type="submit">
          {pending ? "Đang gửi…" : "Gửi sơ yếu lý lịch"}
        </button>
      </div>
    </form>
  );
}
