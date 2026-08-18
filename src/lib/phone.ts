export type ContactCard = {
  id: string;
  fullName: string;
  subtitle: string;
  phone: string;
};

export function digitsPhone(raw?: string | null) {
  return String(raw ?? "").replace(/\D/g, "");
}

export function telHref(raw?: string | null) {
  const digits = digitsPhone(raw);
  return digits ? `tel:${digits}` : "";
}

export function zaloHref(raw?: string | null) {
  const digits = digitsPhone(raw);
  return digits ? `https://zalo.me/${digits}` : "";
}
