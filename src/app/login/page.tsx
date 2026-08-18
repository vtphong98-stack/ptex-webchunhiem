import { Suspense } from "react";

import { LoginForm } from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="py-8">
          <div className="officer-form">
            <p style={{ textAlign: "center" }}>Đăng nhập báo cáo</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
