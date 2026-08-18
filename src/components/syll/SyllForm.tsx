"use client";

import { useState, type HTMLAttributes } from "react";

import { CLASS_SITE } from "@/lib/class-site";
import { SYLL_SHEETS_WEBAPP_URL } from "@/lib/google-sheets";

async function syncSheetsFromBrowser(formData: FormData) {
  try {
    const body = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      body.append(key, String(value ?? ""));
    }
    const response = await fetch(SYLL_SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await response.text();
    const json = JSON.parse(text) as { result?: string };
    if (json.result === "success") return true;
    if (json.result === "error" && /đã có dữ liệu/i.test(text)) {
      body.set("action", "edit");
      const retry = await fetch(SYLL_SHEETS_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const retryText = await retry.text();
      return (JSON.parse(retryText) as { result?: string }).result === "success";
    }
    return false;
  } catch {
    return false;
  }
}

function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="syll-field">
      <span>{label}</span>
      <input inputMode={inputMode} name={name} placeholder={placeholder} required={required} type={type} />
    </label>
  );
}

export function SyllForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData(form);
      const response = await fetch("/api/syll", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Không gửi được sơ yếu lý lịch.");
        return;
      }

      let sheetsSynced = Boolean(data.sheetsSynced);
      if (!sheetsSynced) {
        sheetsSynced = await syncSheetsFromBrowser(formData);
      }

      setMessage(
        sheetsSynced
          ? "Đã lưu sơ yếu lý lịch vào dữ liệu lớp và Google Sheet."
          : "Đã lưu vào dữ liệu lớp. Google Sheet chưa ghi được — GVCN cần mở lại quyền web app (Anyone).",
      );
      form.reset();
    } catch {
      setError("Không gửi được. Thử lại sau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="syll-form" onSubmit={(event) => void handleSubmit(event)}>
      <p className="syll-section">Thông tin học sinh</p>
      <div className="syll-grid">
        <Field inputMode="numeric" label="Số thứ tự (TT)" name="tt" placeholder="1" required />
        <Field label="Họ và tên" name="fullName" placeholder="Nguyễn Văn A" required />
        <Field label="Ngày sinh" name="birthDate" placeholder="24/08/2010" required />
        <Field label="Nơi sinh" name="birthPlace" placeholder="An Giang" />
        <label className="syll-field">
          <span>Giới tính</span>
          <div className="syll-options">
            <label>
              <input name="gender" type="radio" value="Nam" /> Nam
            </label>
            <label>
              <input name="gender" type="radio" value="Nữ" /> Nữ
            </label>
          </div>
        </label>
        <label className="syll-field">
          <span>Dân tộc</span>
          <select defaultValue="Kinh" name="ethnicity">
            <option value="Kinh">Kinh</option>
            <option value="Hoa">Hoa</option>
            <option value="Khmer">Khmer</option>
            <option value="Chăm">Chăm</option>
            <option value="Khác">Khác</option>
          </select>
        </label>
        <Field label="Diện chính sách" name="policy" placeholder="Không / SCN…" />
        <Field label="Chức vụ lớp" name="classRole" placeholder="Lớp trưởng, tổ viên..." />
        <Field label="Hạnh kiểm năm trước" name="conduct" placeholder="Tốt" />
        <Field label="Học lực năm trước" name="academic" placeholder="Giỏi" />
      </div>

      <p className="syll-section">Nơi ở</p>
      <div className="syll-grid">
        <Field label="Ấp / khu phố" name="addressGroup" placeholder="Tổ 1, Ấp An Ninh" />
        <Field label="Xã / phường" name="addressWard" placeholder="Mỹ Hòa Hưng" />
        <Field label="Tỉnh / thành" name="addressProvince" placeholder="An Giang" />
      </div>

      <p className="syll-section">Gia đình</p>
      <div className="syll-grid">
        <Field label="Họ tên cha" name="fatherName" />
        <Field label="Nghề nghiệp cha" name="fatherJob" />
        <Field label="Họ tên mẹ" name="motherName" />
        <Field label="Nghề nghiệp mẹ" name="motherJob" />
        <Field inputMode="tel" label="SĐT phụ huynh" name="contactPhone" placeholder="09xxxxxxxx" required />
      </div>

      <p className="syll-section">Liên hệ học sinh</p>
      <div className="syll-grid">
        <Field inputMode="tel" label="SĐT học sinh" name="studentPhone" placeholder="09xxxxxxxx" />
        <Field label="Email" name="email" type="email" />
        <Field inputMode="numeric" label="CCCD / CMND" name="idNumber" />
      </div>

      <p className="syll-section">Sức khỏe & học tập</p>
      <div className="syll-grid">
        <Field inputMode="decimal" label="Cân nặng (kg)" name="weight" />
        <Field inputMode="decimal" label="Chiều cao (cm)" name="height" />
        <Field label="Bệnh về mắt" name="eyeDisease" placeholder="Không / Cận thị…" />
        <Field label="Tiền sử bệnh" name="medicalHistory" placeholder="Không có, hen suyễn…" />
        <label className="syll-field">
          <span>Biết bơi</span>
          <div className="syll-options">
            <label>
              <input name="canSwim" type="checkbox" /> Có thể bơi
            </label>
          </div>
        </label>
        <label className="syll-field">
          <span>Phương tiện đến trường</span>
          <div className="syll-options">
            <label>
              <input name="transport" type="radio" value="Xe Đạp" /> Xe đạp
            </label>
            <label>
              <input name="transport" type="radio" value="Xe Máy/Máy Điện" /> Xe máy / máy điện
            </label>
            <label>
              <input name="transport" type="radio" value="Khác" /> Khác
            </label>
          </div>
        </label>
        <label className="syll-field syll-span">
          <span>Điều kiện học online</span>
          <div className="syll-options">
            <label>
              <input name="onlineLearning" type="radio" value="Đủ ĐK Học" /> Đủ điều kiện
            </label>
            <label>
              <input name="onlineLearning" type="radio" value="Không Đủ ĐK" /> Không đủ
            </label>
            <label>
              <input name="onlineLearning" type="radio" value="Có Thể Nhờ Bạn" /> Có thể nhờ bạn
            </label>
          </div>
        </label>
      </div>

      <label className="syll-field">
        <span>Ghi chú</span>
        <input name="notes" placeholder="Thông tin thêm (nếu có)" />
      </label>

      <label className="syll-field">
        <span>Hình thức gửi</span>
        <div className="syll-options">
          <label>
            <input defaultChecked name="action" type="radio" value="add" /> Thêm mới
          </label>
          <label>
            <input name="action" type="radio" value="edit" /> Chỉnh sửa (cùng TT)
          </label>
        </div>
      </label>

      <p className="syll-hint">
        {CLASS_SITE.fullName}. Hồ sơ lưu trên web lớp và đồng bộ Google Sheet LyLich.
      </p>
      {message ? <p className="syll-ok">{message}</p> : null}
      {error ? <p className="syll-err">{error}</p> : null}
      <button className="button-primary w-full" disabled={pending} type="submit">
        {pending ? "Đang lưu…" : "Gửi sơ yếu lý lịch"}
      </button>
    </form>
  );
}
