type TelegramParseMode = "Markdown" | "HTML";

export async function sendTelegram(
  text: string,
  opts?: { parse_mode?: TelegramParseMode }
) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  // ✅ debug ให้รู้เลยว่า env มาครบไหม (ดูใน Vercel Functions Logs)
  console.log("TG ENV:", { hasToken: !!token, hasChatId: !!chatId });

  if (!token || !chatId) {
    console.warn("Telegram skipped: env missing");
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

  const json = await res.json();
  console.log("Telegram response:", json);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.description || `Telegram send failed (${res.status})`);
  }

  return json;
}
