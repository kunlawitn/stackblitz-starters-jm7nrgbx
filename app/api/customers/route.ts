import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegram } from "@/lib/telegram";

function calcStatus(expiryDate: string | null | undefined) {
  if (!expiryDate) return "EXPIRED" as const;

  const nowMs = Date.now();
  const expMs = new Date(expiryDate).getTime();
  if (Number.isNaN(expMs)) return "EXPIRED" as const;

  const diffDays = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "EXPIRED" as const;
  if (diffDays <= 15) return "EXPIRING" as const;
  return "ACTIVE" as const;
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").toLowerCase();
  const status = searchParams.get("status") || "ALL";
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return new Response(error.message, { status: 500 });

  const mapped = (data || []).map((c) => ({
    ...c,
    status: calcStatus(c.expiry_date),
  }));

  const filtered = mapped.filter((c) => {
    const hit =
      !query ||
      (c.name || "").toLowerCase().includes(query) ||
      (c.phone || "").toLowerCase().includes(query) ||
      (c.line_id || "").toLowerCase().includes(query) ||
      (c.account_no || "").toLowerCase().includes(query);

    const okStatus = status === "ALL" ? true : c.status === status;
    return hit && okStatus;
  });

  return Response.json(filtered);
}

export async function POST(req: Request) {
  const body = await req.json();

  const payload = {
    name: body.name,
    phone: body.phone || null,
    line_id: body.line_id || null,
    account_no: body.account_no,
    broker_name: (body.broker_name || "Eterwealth").trim() || "Eterwealth",
    tradingview_user: body.tradingview_user?.trim() || null, // ✅ เพิ่ม
    plan_type: body.plan_type || "MONTHLY_1000",
    expiry_date: body.expiry_date ? String(body.expiry_date).slice(0, 10) : null,
    note: body.note || null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.name) return new Response("name is required", { status: 400 });
  if (!payload.account_no) return new Response("account_no is required", { status: 400 });
  if (!payload.expiry_date) return new Response("expiry_date is required", { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert(payload)
    .select("*")
    .single();

  if (error) return new Response(error.message, { status: 500 });

  // ✅ Telegram (กันพังด้วย try/catch)
  try {
    await sendTelegram(
      `✅ *สมัครใหม่*\n` +
      `👤 ${data.name}\n` +
      `📞 ${data.phone || "-"} | LINE: ${data.line_id || "-"}\n` +
      `🏦 Broker: ${data.broker_name || "-"}\n` +
      `🧾 Account: \`${data.account_no}\`\n` +
      `📺 TV: ${data.tradingview_user || "-"}\n` +
      `📦 Plan: ${data.plan_type}\n` +
      `⏳ Expiry: ${data.expiry_date}`,
      { parse_mode: "Markdown" }
    );
  } catch (e: any) {
    console.error("Telegram failed:", e?.message || e);
  }

  return Response.json(data);
}

