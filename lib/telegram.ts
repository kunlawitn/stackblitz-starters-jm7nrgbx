type TelegramOpts = {
  parse_mode?: "HTML" | "Markdown";
};

export async function sendTelegram(text: string, opts?: TelegramOpts) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!token || !chatId) return;

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: opts?.parse_mode || "HTML",
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  console.log("Telegram response:", json);

  if (!json.ok) throw new Error(json.description);
}
