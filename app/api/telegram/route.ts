import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.TG_BOT_TOKEN!;
  const chatId = process.env.TG_CHAT_ID!;
  if (!token || !chatId) {
    return NextResponse.json({ ok: false, error: "Missing TG_BOT_TOKEN or TG_CHAT_ID" }, { status: 500 });
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: "✅ Indy CRM: Telegram test ok" }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : 500 });
}
