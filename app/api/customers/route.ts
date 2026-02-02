import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegram } from "@/lib/telegram";
import { getPlanValue, monthStartISO } from "@/lib/planValue";

type Status = "ACTIVE" | "EXPIRING" | "EXPIRED";

function calcStatus(expiryDate: string | null | undefined): Status {
  if (!expiryDate) return "EXPIRED";

  const nowMs = Date.now();
  const expMs = new Date(expiryDate).getTime();
  if (Number.isNaN(expMs)) return "EXPIRED";

  const diffDays = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "EXPIRED";
  if (diffDays <= 15) return "EXPIRING";
  return "ACTIVE";
}

function norm(v: any): string {
  return String(v ?? "").toLowerCase().trim();
}

function toDateOnly(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const query = norm(searchParams.get("query"));
  const status = (searchParams.get("status") || "ALL").toUpperCase() as
    | "ALL"
    | Status;

  const ownerId = (searchParams.get("ownerId") || "").trim();

  let q = supabaseAdmin
    .from("customers")
    .select(
      `
        *,
        owner:customer_owners (
          id,
          name
        )
      `
    )
    .order("created_at", { ascending: false });

  if (ownerId) q = q.eq("owner_id", ownerId);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const mapped = (data || []).map((c: any) => ({
    ...c,
    status: calcStatus(c.expiry_date),
    owner_name: c?.owner?.name ?? null,
  }));

  const filtered = mapped.filter((c: any) => {
    const okStatus = status === "ALL" ? true : c.status === status;
    if (!query) return okStatus;

    const hit =
      norm(c.name).includes(query) ||
      norm(c.phone).includes(query) ||
      norm(c.line_id).includes(query) ||
      norm(c.account_no).includes(query) ||
      norm(c.tradingview_user).includes(query) ||
      norm(c.broker_name).includes(query) ||
      norm(c.owner_name).includes(query);

    return hit && okStatus;
  });

  return Response.json(filtered);
}

export async function POST(req: Request) {
  const body = await req.json();

  const payload = {
    name: String(body.name || "").trim(),
    phone: body.phone ? String(body.phone).trim() : null,
    line_id: body.line_id ? String(body.line_id).trim() : null,
    account_no: body.account_no ? String(body.account_no).trim() : null,
    broker_name: String(body.broker_name || "Eterwealth").trim() || "Eterwealth",
    tradingview_user: body.tradingview_user
      ? String(body.tradingview_user).trim()
      : null,
    plan_type: String(body.plan_type || "MONTHLY_1000").trim() || "MONTHLY_1000",
    expiry_date: toDateOnly(body.expiry_date),
    note: body.note ? String(body.note).trim() : null,
    owner_id: body.owner_id ? String(body.owner_id).trim() : null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.name) return new Response("name is required", { status: 400 });
  if (!payload.account_no)
    return new Response("account_no is required", { status: 400 });
  if (!payload.expiry_date)
    return new Response("expiry_date is required", { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert(payload)
    .select(
      `
        *,
        owner:customer_owners (
          id,
          name
        )
      `
    )
    .single();

  if (error) return new Response(error.message, { status: 500 });

  // ✅ Billing event (สมัครใหม่) — กันพังด้วย try/catch
  try {
    const pv = getPlanValue(data.plan_type);
    if (pv.countable) {
      const { error: eBill } = await supabaseAdmin.from("billing_events").insert({
        customer_id: data.id,
        owner_id: data.owner_id ?? null,
        event_type: "NEW",
        plan_type: data.plan_type,
        amount: pv.amount,
        currency: pv.currency,
        event_at: new Date().toISOString(),
        event_month: monthStartISO(new Date()),
      });

      if (eBill) {
        // ไม่ให้สมัครลูกค้าล้มเพราะ billing event
        console.error("billing_events insert failed:", eBill.message);
      }
    }
  } catch (e: any) {
    console.error("billing_events failed:", e?.message || e);
  }

  // ✅ Telegram
  try {
    await sendTelegram(
      `✅ <b>สมัครใหม่</b>\n` +
        `👤 ${data.name}\n` +
        `🧑‍💼 แม่ทีม: ${data?.owner?.name || "-"}\n` +
        `📞 ${data.phone || "-"} | Line/Facebook: ${data.line_id || "-"}\n` +
        `🏦 Broker: ${data.broker_name || "-"}\n` +
        `🧾 User ID: <code>${data.account_no}</code>\n` +
        `📺 TV: ${data.tradingview_user || "-"}\n` +
        `📦 Plan: ${data.plan_type}\n` +
        `⏳ Expiry: ${data.expiry_date}`,
      { parse_mode: "HTML" }
    );
  } catch (e: any) {
    console.error("Telegram failed:", e?.message || e);
  }

  return Response.json(data);
}