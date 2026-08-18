export const SYLL_SHEETS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbw5N0DCHOZCdf0jPEUOR4cynL7_6d6xBBg3EXkGASEufMuhw79moAitIs9YckrPr7QClA/exec";

export type SheetsSyncResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  text?: string;
  message?: string;
  error?: string;
};

function parseSheetsPayload(text: string) {
  try {
    return JSON.parse(text) as { result?: string; message?: string };
  } catch {
    return {};
  }
}

export async function syncSyllToGoogleSheets(fields: Record<string, string>): Promise<SheetsSyncResult> {
  const url = process.env.SYLL_SHEETS_WEBAPP_URL || SYLL_SHEETS_WEBAPP_URL;
  if (!url) return { ok: false, skipped: true };
  const body = new URLSearchParams(fields);

  try {
    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        response = await fetch(location, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          redirect: "follow",
        });
      }
    }

    const text = await response.text();
    const json = parseSheetsPayload(text);
    if (json.result === "success") return { ok: true, status: response.status, text: text.slice(0, 400) };
    if (json.result === "error") {
      return { ok: false, status: response.status, text: text.slice(0, 400), message: json.message };
    }
    if (response.status === 403 || /truy cập bị từ chối/i.test(text)) {
      return {
        ok: false,
        status: 403,
        text: text.slice(0, 400),
        message: "Google Sheet đang chặn web app (403). Cần Deploy lại Apps Script: Execute as Me, Who has access = Anyone.",
      };
    }
    return { ok: false, status: response.status, text: text.slice(0, 400) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "sheets_failed" };
  }
}

export function shouldRetrySheetsAsEdit(result: SheetsSyncResult) {
  return /đã có dữ liệu/i.test(`${result.message ?? ""} ${result.text ?? ""}`);
}
