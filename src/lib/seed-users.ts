import type { AppRole } from "@/lib/types";

export type SeedUser = {
  username: string;
  password: string;
  fullName: string;
  role: AppRole;
  teamNumber: number | null;
  aliases?: string[];
  resetPassword: boolean;
};

export function getSeedUsers(): SeedUser[] {
  return [
    {
      username: process.env.SEED_ADMIN_USERNAME ?? "admin",
      password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@2026",
      fullName: "Quản trị hệ thống",
      role: "admin",
      teamNumber: null,
      resetPassword: false,
    },
    {
      username: process.env.SEED_GVCN_USERNAME ?? "gvcn",
      password: process.env.SEED_GVCN_PASSWORD ?? "Gvcn@2026",
      fullName: "Giáo viên chủ nhiệm",
      role: "gvcn",
      teamNumber: null,
      resetPassword: false,
    },
    {
      username: "lt",
      password: "lt",
      fullName: "Lớp trưởng",
      role: "lopTruong",
      teamNumber: null,
      aliases: ["loptruong"],
      resetPassword: false,
    },
    {
      username: "lpht",
      password: "lpht",
      fullName: "Lớp phó học tập",
      role: "lopPhoHocTap",
      teamNumber: null,
      aliases: ["lopphohoctap"],
      resetPassword: false,
    },
    {
      username: "lpld",
      password: "lpld",
      fullName: "Lớp phó lao động",
      role: "lopPhoLaoDong",
      teamNumber: null,
      aliases: ["loppholaodong"],
      resetPassword: false,
    },
    {
      username: "lppt",
      password: "lppt",
      fullName: "Lớp phó phong trào",
      role: "lopPhoPhongTrao",
      teamNumber: null,
      aliases: ["lopphophongtrao"],
      resetPassword: false,
    },
    {
      username: "lptt",
      password: "lptt",
      fullName: "Lớp phó trật tự",
      role: "lopPhoTratTu",
      teamNumber: null,
      aliases: ["lopphotrattu"],
      resetPassword: false,
    },
    {
      username: "thuquy",
      password: "thuquy123",
      fullName: "Thủ quỹ",
      role: "thuQuy",
      teamNumber: null,
      resetPassword: false,
    },
    {
      username: "tt1",
      password: "tt1",
      fullName: "Tổ trưởng tổ 1",
      role: "toTruong",
      teamNumber: 1,
      resetPassword: false,
    },
    {
      username: "tt2",
      password: "tt2",
      fullName: "Tổ trưởng tổ 2",
      role: "toTruong",
      teamNumber: 2,
      resetPassword: false,
    },
    {
      username: "tt3",
      password: "tt3",
      fullName: "Tổ trưởng tổ 3",
      role: "toTruong",
      teamNumber: 3,
      resetPassword: false,
    },
    {
      username: "tt4",
      password: "tt4",
      fullName: "Tổ trưởng tổ 4",
      role: "toTruong",
      teamNumber: 4,
      resetPassword: false,
    },
  ];
}

export const USERNAME_ALIASES: Record<string, string> = {
  loptruong: "lt",
  lopphohoctap: "lpht",
  loppholaodong: "lpld",
  lopphophongtrao: "lppt",
  lopphotrattu: "lptt",
  tt: "tt1",
};
