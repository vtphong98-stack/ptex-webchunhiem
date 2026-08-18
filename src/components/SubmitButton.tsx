"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "button-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? (pendingText ?? "Đang xử lý…") : children}
    </button>
  );
}
