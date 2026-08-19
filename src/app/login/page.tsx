import { Suspense } from "react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login/LoginForm";
import { getSessionUser } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) {
    redirect("/dashboard");
  }

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
