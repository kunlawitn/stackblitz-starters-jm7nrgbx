import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendTelegram } from "../../../../../lib/telegram";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { id } = params;

  const months = Number(body.months ?? 1);

  // 1) ดึงข้อมูลลูกค้าเดิม
  const { data: customer, error: e1 } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (e1 || !customer) return new Response(e1?.message || "Not found", { status: 404 });

  // 2) คำนวณวันหมดอายุใหม่
  const oldExpiry = new Date(customer.expiry_date);
  const base = Number.isNaN(oldExpiry.getTime()) ? new Date() : oldExpiry;
  base.setMonth(base.getMonth() + months);
  const newExpiry = base.toISOString().slice(0, 10);

  // 3) อัปเดต + log
  const { error: e2 } = await supabaseAdmin
    .from("customers")
    .update({ expiry_date: newExpiry, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (e2) return new Response(e2.message, { status: 500 });

  await supabaseAdmin.from("renewal_log").insert({
    customer_id: id,
    months,
    old_expiry_date: customer.expiry_date,
    new_expiry_date: newExpiry,
    created_at: new Date().toISOString(),
  });

  // 4) Telegram
  await sendTelegram(
    `✅ ต่ออายุสำเร็จ\n` +
    `ชื่อ: ${customer.name}\n` +
    `เดือน: +${months}\n` +
    `หมดอายุใหม่: ${newExpiry}\n` +
    `Broker: ${customer.broker_name || "-"}\n` +
    `Account: ${customer.account_no || "-"}\n` +
    `TV: ${customer.tradingview_user || "-"}`
  );

  return Response.json({ ok: true, new_expiry_date: newExpiry });
}
