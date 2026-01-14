export async function sendTelegram(
  text: string,
  opts?: { parse_mode?: "Markdown" | "HTML" }
) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  // ถ้ายังไม่ตั้ง env ให้ไม่ล้ม
  if (!token || !chatId) {
    console.warn("Telegram env missing: TG_BOT_TOKEN or TG_CHAT_ID");
    return { ok: false, skipped: true };
  }

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: opts?.parse_mode ?? "Markdown",
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("Telegram API error:", res.status, data);
    throw new Error(`Telegram send failed (${res.status})`);
  }

  return data;
}
