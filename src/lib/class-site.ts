export const CLASS_SITE = {
  className: "12C1",
  schoolYear: "2024-2025",
  fullName: "Lớp 12C1 - 2024-2025",
  gvcnName: "Võ Thanh Phong",
  gvcnPhone: "0382311919",
  examTitle: "Thi học kỳ 1",
  examDate: "29/12/2025",
  examDateIso: "2025-12-29",
  careerBot:
    "https://chatgpt.com/g/g-678f082a9d9881919d4898ebe84b9061-ai-huong-nghiep/c/68b907f1-72d8-8329-8471-7af0473f6c55",
  careerForm: "https://forms.gle/kexLsyinrctLgZBZ8",
  album: "https://photos.app.goo.gl/RXmdLwygHYZsgWzs8",
  syll: "https://soyeulylichlop.vercel.app/",
  parents: "http://lienheph.vercel.app/",
  morningTitle: "Buổi Sáng (Áp dụng: 01-12-2025)",
  afternoonTitle: "Trái Buổi: Chiều",
};

export const DAYS = ["hai", "ba", "tư", "năm", "sáu", "bảy"] as const;
export const DAY_LABELS = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy"];

export type TimetableCell = {
  subject: string;
  teacher?: string;
  className?: string;
  rowspan?: number;
  skip?: boolean;
};

export const MORNING_TIMETABLE: Record<number, TimetableCell[]> = {
  1: [
    { subject: "HĐTN", teacher: "Phạm Thị Minh Châu", className: "subject-hdtn", rowspan: 2 },
    { subject: "Anh", teacher: "Nguyễn Thanh Tuyền", className: "subject-anh" },
    { subject: "Toán", teacher: "Võ Thanh Phong", className: "subject-toan" },
    { subject: "Toán", teacher: "Võ Thanh Phong", className: "subject-toan" },
    { subject: "Anh", teacher: "Nguyễn Thanh Tuyền", className: "subject-anh" },
    { subject: "-" },
  ],
  2: [
    { subject: "", skip: true },
    { subject: "Anh", teacher: "Nguyễn Thanh Tuyền", className: "subject-anh" },
    { subject: "Toán", teacher: "Võ Thanh Phong", className: "subject-toan" },
    { subject: "Toán", teacher: "Võ Thanh Phong", className: "subject-toan" },
    { subject: "Văn", teacher: "Nguyễn Văn Thị", className: "subject-van" },
    { subject: "-" },
  ],
  3: [
    { subject: "Địa", teacher: "Lê Ngọc Lài", className: "subject-dia" },
    { subject: "GDKT&PL", teacher: "Nguyễn Thị Cước", className: "subject-gdktpl" },
    { subject: "Sử", teacher: "Bùi Văn Lới", className: "subject-su" },
    { subject: "Địa", teacher: "Lê Ngọc Lài", className: "subject-dia" },
    { subject: "Văn", teacher: "Nguyễn Văn Thị", className: "subject-van" },
    { subject: "-" },
  ],
  4: [
    { subject: "Sử", teacher: "Bùi Văn Lới", className: "subject-su" },
    { subject: "Văn", teacher: "Nguyễn Văn Thị", className: "subject-van" },
    { subject: "Tin", teacher: "Nguyễn Hồng Nhung", className: "subject-tin" },
    { subject: "Địa", teacher: "Lê Ngọc Lài", className: "subject-dia" },
    { subject: "CN(CN)", teacher: "Trần Lâm Tùng", className: "subject-cn" },
    { subject: "-" },
  ],
  5: [
    { subject: "Tin", teacher: "Nguyễn Hồng Nhung", className: "subject-tin" },
    { subject: "Văn", teacher: "Nguyễn Văn Thị", className: "subject-van" },
    { subject: "CN(CN)", teacher: "Trần Lâm Tùng", className: "subject-cn" },
    { subject: "GDKT&PL", teacher: "Nguyễn Thị Cước", className: "subject-gdktpl" },
    { subject: "SHCN", teacher: "Võ Thanh Phong", className: "subject-shcn" },
    { subject: "-" },
  ],
};

export const AFTERNOON_TIMETABLE: Record<number, TimetableCell[]> = {
  2: [
    { subject: "-" },
    { subject: "Sử", teacher: "Bùi Văn Lới", className: "subject-su" },
    { subject: "Văn", teacher: "Nguyễn Văn Thị", className: "subject-van" },
    { subject: "Toán", teacher: "Võ Thanh Phong", className: "subject-toan" },
    { subject: "GDTC", teacher: "Trương Hoàng Em", className: "subject-gdtc" },
    { subject: "-" },
  ],
  3: [
    { subject: "-" },
    { subject: "Sử", teacher: "Bùi Văn Lới", className: "subject-su" },
    { subject: "Văn", teacher: "Nguyễn Văn Thị", className: "subject-van" },
    { subject: "Toán", teacher: "Võ Thanh Phong", className: "subject-toan" },
    { subject: "GDTC", teacher: "Trương Hoàng Em", className: "subject-gdtc" },
    { subject: "-" },
  ],
  4: [
    { subject: "GDHN", teacher: "Phạm Thị Minh Châu", className: "subject-gdhn" },
    { subject: "GDKT&PL", teacher: "Nguyễn Thị Cước", className: "subject-gdktpl" },
    { subject: "Địa", teacher: "Lê Ngọc Lài", className: "subject-dia" },
    { subject: "Anh", teacher: "Nguyễn Thanh Tuyền", className: "subject-anh" },
    { subject: "GDQP", teacher: "Lê Minh Tuấn", className: "subject-gdqp" },
    { subject: "-" },
  ],
  5: [
    { subject: "GDHN", teacher: "Phạm Thị Minh Châu", className: "subject-gdhn" },
    { subject: "GDKT&PL", teacher: "Nguyễn Thị Cước", className: "subject-gdktpl" },
    { subject: "Địa", teacher: "Lê Ngọc Lài", className: "subject-dia" },
    { subject: "Anh", teacher: "Nguyễn Thanh Tuyền", className: "subject-anh" },
    { subject: "GDQP", teacher: "Lê Minh Tuấn", className: "subject-gdqp" },
    { subject: "-" },
  ],
};

export const OFFICER_LINKS = [
  { href: "/login?user=lt", label: "Lớp Trưởng", code: "lt", icon: "crown", className: "link-8" },
  { href: "/login?user=lpht", label: "Lớp Phó Học Tập", code: "lpht", icon: "book", className: "link-7" },
  { href: "/login?user=lpld", label: "Lớp Phó Lao Động", code: "lpld", icon: "broom", className: "link-4" },
  { href: "/login?user=lppt", label: "Lớp Phó Phong Trào", code: "lppt", icon: "music", className: "link-5" },
  { href: "/login?user=lptt", label: "Lớp Phó Trật Tự", code: "lptt", icon: "gavel", className: "link-6" },
  { href: "/login?user=tt", label: "Tổ Trưởng", code: "tt", icon: "user", className: "link-2" },
  { href: "/login?user=thuquy", label: "Thủ Quỹ", code: "thuquy", icon: "wallet", className: "link-3" },
];

export const LEARNING_LINKS = [
  { href: "https://vi.khanacademy.org/", label: "KAV" },
  { href: "https://roboki.vn/g/681d6f075a561b1d5e71e835", label: "Gia sư ROBOKI AI" },
  { href: "https://smsedu.smas.edu.vn/User/Login?ReturnUrl=%2f", label: "Kết quả học tập Smas" },
  { href: "https://toanmath.com/", label: "Kho tài liệu & Đề thi Toán" },
];
