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
      { name: "notice_guild", label: "1. Thông báo bên Đoàn (Ra chơi đoàn mời)", placeholder: "Ví dụ: Lấy sổ đoàn ký tên" },
      { name: "absent_student", label: "2. Học sinh vắng (SDB)", placeholder: "Ví dụ: Phong(28/8)" },
      { name: "late_student", label: "3. Học sinh đi trễ (Đoàn ghi)", placeholder: "Ví dụ: Phong(29/8)" },
      { name: "violation_guild", label: "4. Vi phạm bên Đoàn (Đồng phục, thức ăn, đầu tóc)", placeholder: "Ví dụ: Phong(Đồng phục 29/8)" },
      { name: "future_plan", label: "5. Phương hướng tuần sau", placeholder: "Ví dụ: Tham gia lao động" },
    ];
  }

  if (role === "lopPhoHocTap") {
    return [
      { name: "good_points", label: "1. Điểm tốt (Tổng lớp)" },
      { name: "speaking", label: "2. Phát biểu (Tổng lớp)" },
      { name: "teacher_reminded", label: "3. Môn học bị giáo viên nhắc (Lý do)" },
      { name: "future_plan", label: "4. Phương hướng tuần sau" },
      { name: "suggestions", label: "5. Ý kiến đề xuất" },
    ];
  }

  if (role === "lopPhoLaoDong") {
    return [
      { name: "cleaning_team", label: "1. Tổ trực vệ sinh lớp" },
      { name: "chair_team", label: "2. Tổ trực mang ghế ra sân" },
      { name: "monday", label: "3. Thứ 2 (Tên HS trực)" },
      { name: "tuesday", label: "4. Thứ 3 (Tên HS trực)" },
      { name: "wednesday", label: "5. Thứ 4 (Tên HS trực)" },
      { name: "thursday", label: "6. Thứ 5 (Tên HS trực)" },
      { name: "friday", label: "7. Thứ 6 (Tên HS trực)" },
      { name: "saturday", label: "8. Thứ 7 (Tên HS trực)" },
      { name: "late_duty", label: "9. Trực trễ ngày nào?" },
      { name: "feedback", label: "10. Ý kiến phản hồi" },
    ];
  }

  if (role === "lopPhoPhongTrao") {
    return [
      { name: "campaign_name", label: "1. Tên phong trào" },
      { name: "implementation_time", label: "2. Thời gian thực hiện" },
      { name: "progress", label: "3. Tiến độ thực hiện" },
      { name: "assigned_students", label: "4. Phân công học sinh phụ trách" },
      { name: "competition_date", label: "5. Ngày thi" },
      { name: "estimated_cost", label: "6. Dự kiến kinh phí" },
    ];
  }

  if (role === "lopPhoTratTu") {
    return [
      { name: "disorder_not_sdb", label: "1. Học sinh mất trật tự (chưa ghi SDB)" },
      { name: "disorder_not_sdb_count", label: "2. Tổng số lượt (chưa ghi SDB)" },
      { name: "disorder_sdb", label: "3. Học sinh mất trật tự (đã ghi SDB)" },
      { name: "disorder_sdb_count", label: "4. Tổng số lượt (đã ghi SDB)" },
      { name: "social_media", label: "5. Theo dõi các bài đăng trên mạng" },
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
