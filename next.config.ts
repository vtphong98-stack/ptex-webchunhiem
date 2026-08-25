import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  compress: true,
  serverExternalPackages: ["mongodb", "bcryptjs", "xlsx", "exceljs"],
  // Biểu mẫu sơ yếu lý lịch được đọc lúc chạy bằng đường dẫn dựng từ
  // process.cwd(), nên bộ dò phụ thuộc không thấy — phải khai báo tay để file
  // mẫu đi kèm khi deploy.
  outputFileTracingIncludes: {
    "/api/gvcn/syll/**": ["./src/assets/**"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

