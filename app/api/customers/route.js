import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegram } from "@/lib/telegram";

function calcStatus(expiryDate) {
  const now = new Date();
  const exp = new Date(expiryDate);
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "EXPIRED";
  if (diffDays <= 15) return "EXPIRING";
  return "ACTIVE";
}

export async function GET(req) {
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

export async function POST(req) {
  const body = await req.json();
  const payload = {
    name: body.name,
    phone: body.phone || null,
    line_id: body.line_id || null,
    account_no: body.account_no,
    broker_name: "ETER WEALTH",
    plan_type: body.plan_type || "MONTHLY_1000",
    start_date: body.start_date ? body.start_date.slice(0,10) : null,
    expiry_date: body.expiry_date ? body.expiry_date.slice(0,10) : null,
    note: body.note || null,
  };

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert(payload)
    .select("*")
    .single();

  if (error) return new Response(error.message, { status: 500 });

  await sendTelegram(
    `✅ *สมัครใหม่*\n` +
    `👤 ${data.name}\n` +
    `🧾 Account: \`${data.account_no}\`\n` +
    `📦 Plan: ${data.plan_type}\n` +
    `⏳ Expiry: ${data.expiry_date}`
  );

  return Response.json(data);
}
