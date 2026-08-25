"use client";

import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

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
const POLICY_OPTIONS = ["", "HN", "CN", "KK"];

function foldVi(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
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
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  wide?: boolean;
}) {
  return (
    <label className={`syll-field${wide ? " syll-span" : ""}`}>
      <span className="syll-label">
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      <input
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
      <select defaultValue={defaultValue ?? ""} name={name} required={required}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "— Chưa có —"}
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
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string; icon?: string }>;
  columns?: number;
  wide?: boolean;
}) {
  return (
    <div className={`syll-field${wide ? " syll-span" : ""}`}>
      <span className="syll-label">{label}</span>
      <div className="syll-seg" style={{ "--seg-cols": columns ?? options.length } as React.CSSProperties}>
        {options.map((option) => (
          <label className="syll-seg-item" key={option.value}>
            <input name={name} type="radio" value={option.value} />
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

function ToggleField({ label, name, text }: { label: string; name: string; text: string }) {
  return (
    <div className="syll-field">
      <span className="syll-label">{label}</span>
      <div className="syll-seg" style={{ "--seg-cols": 1 } as React.CSSProperties}>
        <label className="syll-seg-item">
          <input name={name} type="checkbox" value="x" />
          <span>{text}</span>
        </label>
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/syll")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("roster"))))
      .then((data: { students?: RosterStudent[]; deskCount?: number }) => {
        if (cancelled) return;
        setRoster(data.students ?? []);
        if (data.deskCount) setDeskCount(data.deskCount);
      })
      .catch(() => {
        if (!cancelled) setRosterError("Chưa tải được danh sách lớp. Tải lại trang giúp thầy cô nhé.");
      })
      .finally(() => {
        if (!cancelled) setLoadingRoster(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = foldVi(query.trim());
    if (!needle) return roster;
    return roster.filter((student) => foldVi(student.fullName).includes(needle));
  }, [roster, query]);

  const selected = roster.find((student) => student._id === studentId) ?? null;
  const filledCount = roster.filter((student) => student.submitted).length;

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

  return (
    <form className="syll-form" onSubmit={(event) => void handleSubmit(event)} ref={formRef}>
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
          <label className="syll-field">
            <span className="syll-label">
              Họ và tên<b aria-hidden="true"> *</b>
            </span>
            <select
              disabled={loadingRoster || !roster.length}
              onChange={(event) => setStudentId(event.target.value)}
              required
              value={studentId}
            >
              <option value="">
                {loadingRoster ? "Đang tải danh sách…" : roster.length ? "— Chọn tên —" : "Lớp chưa có danh sách"}
              </option>
              {filtered.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.tt ? `${student.tt}. ` : ""}
                  {student.fullName}
                  {student.submitted ? " ✓ đã khai" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!loadingRoster && !roster.length ? (
          <p className="syll-note">
            GVCN chưa nhập danh sách lớp. Thầy cô vào <b>Khu vực GVCN → Sơ yếu lý lịch</b> để tải mẫu và nhập lên.
          </p>
        ) : null}

        {selected?.submitted ? (
          <p className="syll-note syll-note-warn">
            {selected.fullName} đã khai rồi. Gửi lần nữa sẽ <b>ghi đè</b> thông tin cũ.
          </p>
        ) : null}

        {roster.length ? (
          <p className="syll-progress">
            Lớp đã khai <b>{filledCount}</b>/{roster.length} em.
          </p>
        ) : null}
      </section>

      <fieldset className="syll-fieldset" disabled={!studentId}>
        <legend className="sr-only">Thông tin sơ yếu lý lịch</legend>

        <Section title="2. Thông tin học sinh">
          <Field
            hint="Ghi đủ ngày/tháng/năm"
            inputMode="numeric"
            label="Ngày sinh"
            name="birthDate"
            placeholder="24/08/2010"
            required
          />
          <Field label="Nơi sinh (tỉnh)" name="birthPlace" placeholder="An Giang" required />
          <SelectField
            label="Dân tộc"
            name="ethnicity"
            defaultValue="Kinh"
            options={["Kinh", "Hoa", "Khmer", "Chăm", "Khác"]}
          />
          <RadioGroup
            label="Giới tính"
            name="gender"
            options={[
              { value: "Nam", label: "Nam" },
              { value: "Nữ", label: "Nữ" },
            ]}
          />
          <label className="syll-field">
            <span className="syll-label">Diện chính sách</span>
            <select defaultValue="" name="policy">
              {POLICY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code || "Không"}
                </option>
              ))}
            </select>
            <em className="syll-hint-inline">HN: hộ nghèo · CN: cận nghèo · KK: hoàn cảnh khó khăn</em>
          </label>
          <SelectField
            label="Rèn luyện năm trước"
            name="conduct"
            defaultValue=""
            options={["", "Tốt", "Khá", "Đạt", "Chưa đạt"]}
          />
          <SelectField
            label="Học tập năm trước"
            name="academic"
            defaultValue=""
            options={["", "Tốt", "Khá", "Đạt", "Chưa đạt"]}
          />

          <label className="syll-field">
            <span className="syll-label">Chức vụ</span>
            <select onChange={(event) => setDuty(event.target.value)} value={duty}>
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
              Tổ{duty === "toTruong" || duty === "toPho" ? <b aria-hidden="true"> *</b> : null}
            </span>
            <select
              onChange={(event) => pickTeam(event.target.value)}
              required={duty === "toTruong" || duty === "toPho"}
              value={team}
            >
              <option value="">— Chọn tổ —</option>
              {SEAT_TEAMS.map((number) => (
                <option key={number} value={number}>
                  Tổ {number}
                </option>
              ))}
            </select>
          </label>

          <div className="syll-field syll-span">
            <span className="syll-label">Chỗ ngồi</span>
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
                            <span>{holder ?? "còn trống"}</span>
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
          <Field label="Tổ / ấp / khóm" name="addressGroup" placeholder="Tổ 8, ấp An Ninh" required />
          <Field label="Xã / phường" name="addressWard" placeholder="Mỹ An Hưng" required />
          <Field label="Tỉnh / thành phố" name="addressProvince" placeholder="Đồng Tháp" required />
        </Section>

        <Section title="4. Cha mẹ">
          <Field label="Họ và tên cha" name="fatherName" placeholder="Nguyễn Văn A" />
          <Field label="Nghề nghiệp cha" name="fatherJob" placeholder="Nông dân" />
          <Field label="Họ và tên mẹ" name="motherName" placeholder="Trần Thị B" />
          <Field label="Nghề nghiệp mẹ" name="motherJob" placeholder="Nội trợ" />
          <Field
            hint="Số GVCN gọi khi cần — thường là số của cha hoặc mẹ"
            inputMode="tel"
            label="SĐT liên lạc"
            name="contactPhone"
            placeholder="09xxxxxxxx"
            required
          />
          <Field
            hint="Số riêng của mẹ, chỉ dùng để tra cứu — không in vào biểu mẫu"
            inputMode="tel"
            label="SĐT của mẹ"
            name="motherPhone"
            placeholder="09xxxxxxxx"
          />
        </Section>

        <Section title="5. Liên hệ của em">
          <Field inputMode="tel" label="SĐT của em" name="studentPhone" placeholder="09xxxxxxxx" />
          <Field label="Địa chỉ email" name="email" placeholder="ten@gmail.com" type="email" />
          <Field inputMode="numeric" label="Số CCCD / CMND" name="idNumber" placeholder="0892090…" />
        </Section>

        <Section title="6. Sức khỏe">
          <Field inputMode="decimal" label="Cân nặng (kg)" name="weight" placeholder="48" />
          <Field inputMode="decimal" label="Chiều cao (cm)" name="height" placeholder="160" />
          <ToggleField label="Biết bơi" name="canSwim" text="Em biết bơi" />
          <Field label="Bệnh về mắt" name="eyeDisease" placeholder="Cận thị, loạn thị… (nếu có)" />
          <Field
            label="Tiền sử bệnh cần theo dõi"
            name="medicalHistory"
            placeholder="Hen suyễn, tim mạch… (nếu có)"
            wide
          />
        </Section>

        <Section title="7. Đi lại & học trực tuyến">
          <RadioGroup
            label="Phương tiện đến trường"
            name="transport"
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
            options={[
              { value: "Đủ đk học", label: "Đủ điều kiện" },
              { value: "Không đủ đk học", label: "Không đủ" },
              { value: "Có thể nhờ bạn để học", label: "Học nhờ bạn" },
            ]}
            wide
          />
          <Field label="Ghi chú thêm" name="notes" placeholder="Điều gì thầy cô cần biết thêm (nếu có)" wide />
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
