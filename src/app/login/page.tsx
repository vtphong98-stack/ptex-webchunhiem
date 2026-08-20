import { Suspense } from "react";

import { LoginForm } from "@/components/login/LoginForm";
import { areaOf, areaOfUserKey, homePathForRole, nextPathForSession, redirectTo } from "@/lib/access";
import { getClassIdentity } from "@/lib/public-site";
import { getSessionUser } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

/**
 * Does the active session already satisfy the role this login page was opened
 * for? A `false` here means "render the form so the visitor can switch account",
 * never "bounce them somewhere else".
 */
function isSessionMatchingUserKey(session: SessionUser, userKey: string): boolean {
  if (!userKey) return true;
  const k = userKey.toLowerCase();
  if ((k === "gvcn" || k === "admin") && (session.role === "gvcn" || session.role === "admin")) return true;
  if (k === "lt" && session.role === "lopTruong") return true;
  if (k === "lpht" && session.role === "lopPhoHocTap") return true;
  if (k === "lpld" && session.role === "lopPhoLaoDong") return true;
  if (k === "lppt" && session.role === "lopPhoPhongTrao") return true;
  if (k === "lptt" && session.role === "lopPhoTratTu") return true;
  if (k === "thuquy" && session.role === "thuQuy") return true;
  if (k === "tt" && session.role === "toTruong") return true;
  if (k.startsWith("tt") && session.role === "toTruong") {
    const teamNum = parseInt(k.replace("tt", ""));
    if (!teamNum || session.teamNumber === teamNum) return true;
  }
  return false;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ user?: string; next?: string; error?: string }>;
}) {
  const site = await getClassIdentity();
  const params = searchParams ? await searchParams : {};
  const userKey = params.user ?? "";
  const session = await getSessionUser();

  if (session && isSessionMatchingUserKey(session, userKey)) {
    // Send them to their OWN landing page. Sending everyone to /dashboard made
    // an officer session ping-pong: /login -> /dashboard -> back to the report
    // form, so the teacher never got a chance to sign in on a shared device.
    const next = nextPathForSession(session, params.next);
    redirectTo(next || homePathForRole(session.role, session.teamNumber));
  }

  // Either nobody is signed in, or the active session belongs to the other area
  // (e.g. a student is still signed in and the teacher wants the setup desk).
  const signedInAs = session ? `${session.fullName} (${session.username})` : "";
  const requestedArea = areaOfUserKey(userKey);
  const switchingArea = Boolean(session && requestedArea && requestedArea !== areaOf(session.role));

  return (
    <Suspense
      fallback={
        <main className="py-8">
          <div className="officer-form">
            <p style={{ textAlign: "center" }}>Đang mở form đăng nhập…</p>
          </div>
        </main>
      }
    >
      <LoginForm signedInAs={signedInAs} siteName={site.fullName} switchingArea={switchingArea} />
    </Suspense>
  );
}
