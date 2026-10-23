const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export async function tg(method: string, payload: Record<string, unknown>) {
  const lk = process.env["LOVABLE_API_KEY"];
  const tk = process.env["TELEGRAM_API_KEY"];
  if (!lk || !tk) throw new Error("Telegram is not configured");
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": tk, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Telegram ${method} failed [${res.status}]: ${text}`);
    throw new Error(`Telegram ${method} failed [${res.status}]: ${text}`);
  }
  return JSON.parse(text);
}

export async function sendHtml(chatId: number, html: string) {
  try {
    await tg("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  } catch {
    // Fallback: strip tags and send plain text so the user always gets an answer.
    const plain = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    await tg("sendMessage", { chat_id: chatId, text: plain.slice(0, 4096) });
  }
}

export async function webhookSecret(): Promise<string> {
  const data = new TextEncoder().encode(`telegram-webhook:${process.env["TELEGRAM_API_KEY"] ?? ""}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  let s = "";
  for (const b of hash) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
