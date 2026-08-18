const DEFAULT_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbw5N0DCHOZCdf0jPEUOR4cynL7_6d6xBBg3EXkGASEufMuhw79moAitIs9YckrPr7QClA/exec";

export async function syncSyllToGoogleSheets(fields: Record<string, string>) {
  const url = process.env.SYLL_SHEETS_WEBAPP_URL || DEFAULT_SHEETS_URL;
  if (!url) return { ok: false, skipped: true };
  const body = new URLSearchParams(fields);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "follow",
    });
    const text = await response.text();
    return { ok: response.ok, skipped: false, text: text.slice(0, 400) };
  } catch (error) {
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : "sheets_failed" };
  }
}
