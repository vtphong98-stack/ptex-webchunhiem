import { NextResponse } from "next/server";

import { grantSyllPass, hasSyllPass, syllPasswordMatches } from "@/lib/syll-access";
import { resolveSyllContext } from "@/lib/syll-store";
import { toPlainString } from "@/lib/utils";

/** Trang /syll hỏi trạng thái cổng trước khi vẽ form hay ô nhập mật khẩu. */
export async function GET() {
  const context = await resolveSyllContext();
  if (!context) {
    return NextResponse.json({ unlocked: false, locked: false, className: "", fullName: "" });
  }

  return NextResponse.json(
    {
      unlocked: await hasSyllPass(context.schoolYearId),
      locked: context.syllLocked,
      className: context.info.className,
      yearName: context.yearName,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const context = await resolveSyllContext();
  if (!context) {
    return NextResponse.json({ error: "Chưa có năm học hiện hành." }, { status: 400 });
  }

  const form = await request.formData();
  if (!syllPasswordMatches(toPlainString(form.get("password")), context.syllPassword)) {
    return NextResponse.json({ error: "Mật khẩu chưa đúng. Hỏi lại GVCN giúp em nhé." }, { status: 401 });
  }

  await grantSyllPass(context.schoolYearId);
  return NextResponse.json({ ok: true, locked: context.syllLocked });
}
