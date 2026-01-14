type TelegramParseMode = "Markdown" | "HTML";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendTelegram(
  text: string,
  opts?: { parse_mode?: TelegramParseMode }
) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  console.log("TG ENV:", { hasToken: !!token, hasChatId: !!chatId });
  if (!token || !chatId) {
    console.warn("Telegram skipped: env missing");
    return { ok: false, skipped: true };
  }

  const parseMode: TelegramParseMode = opts?.parse_mode ?? "HTML";
  const safeText = parseMode === "HTML" ? escapeHtml(text) : text;

  const payload = {
    chat_id: chatId,
    text: safeText,
    parse_mode: parseMode,
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
