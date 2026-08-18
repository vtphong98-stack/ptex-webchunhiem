import type { AppRole } from "@/lib/types";

export type ReportField = {
  name: string;
  label: string;
  placeholder?: string;
};

export const OFFICER_SLOTS = [
  { key: "lopTruong", label: "LT", role: "lopTruong" as AppRole, teamNumber: null },
  { key: "lopPhoHocTap", label: "LPHT", role: "lopPhoHocTap" as AppRole, teamNumber: null },
  { key: "lopPhoLaoDong", label: "LPLD", role: "lopPhoLaoDong" as AppRole, teamNumber: null },
  { key: "lopPhoPhongTrao", label: "LPPT", role: "lopPhoPhongTrao" as AppRole, teamNumber: null },
  { key: "lopPhoTratTu", label: "LPTT", role: "lopPhoTratTu" as AppRole, teamNumber: null },
  { key: "tt1", label: "TT1", role: "toTruong" as AppRole, teamNumber: 1 },
  { key: "tt2", label: "TT2", role: "toTruong" as AppRole, teamNumber: 2 },
  { key: "tt3", label: "TT3", role: "toTruong" as AppRole, teamNumber: 3 },
  { key: "tt4", label: "TT4", role: "toTruong" as AppRole, teamNumber: 4 },
  { key: "thuQuy", label: "Thủ quỹ", role: "thuQuy" as AppRole, teamNumber: null },
];

export function getReportFields(role: AppRole): ReportField[] {
  if (role === "lopTruong") {
    return [
      {
        name: "class_weekly_review",
        label: "1. Nhận xét lớp tuần qua",
        placeholder: "Thái độ học tập, tình trạng vi phạm, ...",
      },
      {
        name: "guild_bgh_notice",
        label: "2. Thông báo từ đoàn trường, BGH",
        placeholder: "Công việc đã làm, phong trào cần giao LPPT, ...",
      },
      {
        name: "direction_plan",
        label: "3. Phương hướng",
        placeholder: "Giao nhiệm vụ cho học tập, phong trào, ...",
      },
    ];
  }

  if (role === "lopPhoHocTap") {
    return [
      {
        name: "study_attitude",
        label: "1. Thái độ học tập tuần qua",
        placeholder: "Tốt, Trì trệ, Không tốt, ...",
      },
      { name: "study_attitude_reason", label: "2. Lý do", placeholder: "Ví dụ: Lớp tích cực phát biểu" },
      { name: "future_plan", label: "3. Phương hướng tuần sau", placeholder: "Ví dụ: Ôn tập giữa kỳ" },
      { name: "suggestions", label: "4. Đề xuất tuần sau", placeholder: "Ví dụ: Tăng cường kiểm tra bài" },
    ];
  }

  if (role === "lopPhoLaoDong") {
    return [
      { name: "duty_team", label: "Tổ trực" },
      { name: "labor_assignments_summary", label: "Phân công lao động" },
      {
        name: "labor_review",
        label: "Nhận xét tình hình lao động tuần qua",
        placeholder: "Ví dụ: Tổ trực nhiệt tình, lớp sạch sẽ",
      },
    ];
  }

  if (role === "lopPhoPhongTrao") {
    return [
      { name: "campaign_name", label: "Tên phong trào" },
      { name: "implementation_time", label: "Thời gian thực hiện" },
      { name: "progress", label: "Tiến độ" },
      { name: "campaign_assignments_summary", label: "Phân công học sinh" },
    ];
  }

  if (role === "lopPhoTratTu") {
    return [
      { name: "duty_team", label: "Tổ theo dõi" },
      { name: "discipline_records_summary", label: "Theo dõi trật tự" },
      { name: "social_media", label: "Theo dõi các bài đăng trên mạng" },
    ];
  }

  if (role === "toTruong" || role === "toPho") {
    return [
      { name: "not_prepared_names", label: "1. Không thuộc bài (Tên HS)" },
      { name: "not_prepared_count", label: "Tổng số lượt không thuộc bài" },
      { name: "no_homework_names", label: "2. Không làm BTVN (Tên HS)" },
      { name: "no_homework_count", label: "Tổng số lượt không BTVN" },
      { name: "disorder_names", label: "3. Mất trật tự (Tên HS)" },
      { name: "disorder_count", label: "Tổng số lượt mất trật tự" },
      { name: "late_names", label: "4. Đi trễ (Tên HS và ngày)" },
      { name: "late_count", label: "Tổng số lượt đi trễ" },
      { name: "violation_names", label: "5. Vi phạm Đoàn (Tên HS và chi tiết)" },
      { name: "violation_count", label: "Tổng số lượt vi phạm" },
      { name: "absent_names", label: "6. Vắng (Tên HS)" },
      { name: "absent_count", label: "Tổng số lượt vắng" },
      { name: "good_points_names", label: "7. Điểm tốt từ 9 trở lên (Tên HS)" },
      { name: "good_points_count", label: "Tổng số lượt điểm tốt" },
      { name: "participation_names", label: "8. Phát biểu xung phong (Tên HS)" },
      { name: "participation_count", label: "Tổng số lượt phát biểu" },
    ];
  }

  if (role === "thuQuy") {
    return [
      { name: "fee_per_student", label: "1. Tiền thu (1 HS/1 tuần)" },
      { name: "quantity_paid", label: "2. Số lượng HS nộp" },
      { name: "missing_students", label: "3. Tên HS thiếu" },
      { name: "quantity_missing", label: "4. Số lượng HS thiếu" },
      { name: "expense_name_1", label: "5. Tên tiền chi 1" },
      { name: "expense_amount_1", label: "Số tiền chi 1" },
      { name: "expense_name_2", label: "6. Tên tiền chi 2" },
      { name: "expense_amount_2", label: "Số tiền chi 2" },
      { name: "expense_name_3", label: "7. Tên tiền chi 3" },
      { name: "expense_amount_3", label: "Số tiền chi 3" },
      { name: "expense_name_4", label: "8. Tên tiền chi 4" },
      { name: "expense_amount_4", label: "Số tiền chi 4" },
      { name: "expense_name_5", label: "9. Tên tiền chi 5" },
      { name: "expense_amount_5", label: "Số tiền chi 5" },
      { name: "expense_name_6", label: "10. Tên tiền chi 6" },
      { name: "expense_amount_6", label: "Số tiền chi 6" },
    ];
  }

  return [{ name: "summary", label: "Nội dung báo cáo tuần" }];
}

export function getOfficerTitle(role: AppRole, teamNumber?: number | null) {
  if (role === "lopTruong") return "Dành cho lớp trưởng (LT)";
  if (role === "lopPhoHocTap") return "Dành cho lớp phó học tập (LPHT)";
  if (role === "lopPhoLaoDong") return "Dành cho lớp phó lao động (LPLD)";
  if (role === "lopPhoPhongTrao") return "Dành cho lớp phó phong trào (LPPT)";
  if (role === "lopPhoTratTu") return "Dành cho lớp phó trật tự (LPTT)";
  if (role === "toTruong") return `Dành cho tổ trưởng tổ ${teamNumber ?? ""}`.trim();
  if (role === "thuQuy") return "Dành cho thủ quỹ";
  return "Báo cáo tuần";
}
